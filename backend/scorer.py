"""
Pronunciation scoring: CTC forced alignment + GoP (Goodness of Pronunciation).

Pipeline (equivalent to WhisperX + MFA):
  1. faster-whisper  → transcript text (word verification)
  2. wav2vec2-lv-60-espeak-cv-ft → frame-level IPA phoneme log-posteriors
  3. torchaudio.functional.forced_align → phoneme-to-frame alignment (replaces MFA)
  4. GoP = mean log P(correct_phoneme | frames) for each aligned segment → 0–100 score
"""

import torch
import torchaudio
import librosa
import json
from typing import List, Dict, Any

_whisper = None
_w2v_processor = None
_w2v_model = None

W2V_MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"


def load_models():
    _get_whisper()
    _get_wav2vec()


def _get_whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel("base.en", device="cpu", compute_type="int8")
    return _whisper


def _get_wav2vec():
    global _w2v_processor, _w2v_model
    if _w2v_model is None:
        from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
        _w2v_processor = Wav2Vec2Processor.from_pretrained(W2V_MODEL_ID)
        _w2v_model = Wav2Vec2ForCTC.from_pretrained(W2V_MODEL_ID)
        _w2v_model.eval()
    return _w2v_processor, _w2v_model


# Our app IPA → espeak IPA tokens used by wav2vec2-lv-60-espeak-cv-ft
# Values are lists because some diphthongs map to 2 model tokens.
_IPA_TO_ESPEAK: Dict[str, List[str]] = {
    "iː": ["iː"],   "ɪ": ["ɪ"],    "ɛ": ["ɛ"],    "æ": ["æ"],
    "ʌ":  ["ʌ"],    "ə": ["ə"],    "ɜː": ["ɜː"],  "uː": ["uː"],
    "ʊ":  ["ʊ"],    "ɔː": ["ɔː"], "ɑː": ["ɑː"],
    "oʊ": ["əʊ"],  "eɪ": ["eɪ"],  "aɪ": ["aɪ"],  "aʊ": ["aʊ"],
    "ɔɪ": ["ɔɪ"],  "ɑːr": ["ɑːɹ"], "ɔːr": ["ɔːɹ"],
    "ɛər": ["ɛɹ"], "ɪər": ["ɪɹ"],
    "p": ["p"],  "b": ["b"],  "t": ["t"],  "d": ["d"],
    "k": ["k"],  "g": ["ɡ"],  "m": ["m"],  "n": ["n"],
    "ŋ": ["ŋ"],  "f": ["f"],  "v": ["v"],  "θ": ["θ"],
    "ð": ["ð"],  "s": ["s"],  "z": ["z"],  "ʃ": ["ʃ"],
    "ʒ": ["ʒ"],  "h": ["h"],  "r": ["ɹ"],  "j": ["j"],
    "w": ["w"],  "l": ["l"],  "tʃ": ["tʃ"], "dʒ": ["dʒ"],
    "ɾ": ["ɾ"],
}


def _ipa_to_token_ids(ipa: str, vocab: Dict[str, int]) -> List[int]:
    syms = _IPA_TO_ESPEAK.get(ipa, [ipa])
    ids: List[int] = []
    for sym in syms:
        if sym in vocab:
            ids.append(vocab[sym])
        else:
            # Try individual characters (e.g. diphthong fallback)
            for ch in sym:
                if ch in vocab:
                    ids.append(vocab[ch])
    return ids


def transcribe_audio(audio_path: str) -> str:
    whisper = _get_whisper()
    segments, _ = whisper.transcribe(audio_path, language="en")
    return " ".join(s.text.strip() for s in segments).lower().strip()


def score_word(audio_path: str, target_word: str, target_ipa_list: List[str]) -> Dict[str, Any]:
    """
    Returns {phonemes: [{ipa, score, note}], overall, spokenWord}.
    GoP score 0–100 per phoneme via CTC forced alignment.
    """
    proc, model = _get_wav2vec()
    speech, _ = librosa.load(audio_path, sr=16000)

    inputs = proc(speech, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits              # [1, T, V]
    log_probs = torch.log_softmax(logits, dim=-1)   # [1, T, V]

    vocab = proc.tokenizer.get_vocab()
    blank_id = proc.tokenizer.pad_token_id

    # Build flat CTC target sequence; track which positions belong to each IPA
    ipa_token_ids: List[List[int]] = [_ipa_to_token_ids(ipa, vocab) for ipa in target_ipa_list]
    flat_tokens: List[int] = []
    for ids in ipa_token_ids:
        flat_tokens.extend(ids if ids else [blank_id])

    targets = torch.tensor([flat_tokens])
    input_lengths = torch.tensor([log_probs.shape[1]])
    target_lengths = torch.tensor([len(flat_tokens)])

    try:
        # CTC forced alignment — same as what MFA does but using the neural CTC model
        alignment, _ = torchaudio.functional.forced_align(
            log_probs, targets, input_lengths, target_lengths, blank=blank_id
        )
        alignment = alignment[0]  # [T], value = position in flat_tokens
    except Exception as e:
        print(f"forced_align error: {e}")
        return _fallback(target_ipa_list)

    lp = log_probs[0]   # [T, V]
    token_pos = 0
    phoneme_scores: List[int] = []

    for ipa, ids in zip(target_ipa_list, ipa_token_ids):
        if not ids:
            phoneme_scores.append(30)
            token_pos += 1
            continue

        seg_lps: List[float] = []
        for tid in ids:
            frames = (alignment == token_pos).nonzero(as_tuple=True)[0]
            if len(frames) > 0:
                seg_lps.append(lp[frames, tid].mean().item())
            token_pos += 1

        if seg_lps:
            mean_lp = sum(seg_lps) / len(seg_lps)
            # Calibrated: log_prob typically in (-9, -0.3) for this model
            score = int(max(0, min(100, round((mean_lp + 9) / 8.7 * 100))))
        else:
            score = 30
        phoneme_scores.append(score)

    overall = round(sum(phoneme_scores) / len(phoneme_scores))
    spoken = transcribe_audio(audio_path)

    return {
        "phonemes": [
            {
                "ipa": ipa,
                "score": s,
                "note": f"Phát âm chưa đúng /{ipa}/" if s < 65 else None,
            }
            for ipa, s in zip(target_ipa_list, phoneme_scores)
        ],
        "overall": overall,
        "spokenWord": spoken.split()[0] if spoken else None,
    }


def _fallback(ipa_list: List[str]) -> Dict[str, Any]:
    return {
        "phonemes": [{"ipa": ipa, "score": 0, "note": "Không nhận diện được"} for ipa in ipa_list],
        "overall": 0,
        "spokenWord": None,
    }
