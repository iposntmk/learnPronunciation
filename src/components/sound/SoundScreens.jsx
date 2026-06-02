import React, { useState } from 'react'
import { ChevronLeft, ExternalLink, Play, Volume2 } from 'lucide-react'
import AzureUsageBadge from '../common/AzureUsageBadge.jsx'
import { speakNeural } from '../../tts.js'
import {
  SOUNDS,
  VOWEL_GROUPS,
  CONSONANT_GROUPS,
  SPANISH_SOUNDS,
  SPANISH_VOWEL_GROUPS,
  SPANISH_CONSONANT_GROUPS,
  ITALIAN_SOUNDS,
  ITALIAN_VOWEL_GROUPS,
  ITALIAN_CONSONANT_GROUPS,
  FRENCH_SOUNDS,
  FRENCH_VOWEL_GROUPS,
  FRENCH_CONSONANT_GROUPS,
} from '../../data.js'

const RACHEL_URLS = {
  'iː': 'https://rachelsenglish.com/english-pronounce-ee-vowel/',
  'ɪ': 'https://rachelsenglish.com/english-pronounce-ih-vowel/',
  'ɛ': 'https://rachelsenglish.com/english-pronounce-eh-vowel/',
  'æ': 'https://rachelsenglish.com/english-pronounce-aa-ae-vowel/',
  'ʌ': 'https://rachelsenglish.com/english-pronounce-uh-butter-vowel/',
  'ə': 'https://rachelsenglish.com/english-pronounce-schwa/',
  'ɜː': 'https://rachelsenglish.com/english-pronounce-ur-vowel/',
  'uː': 'https://rachelsenglish.com/english-pronounce-oo-vowel/',
  'ʊ': 'https://rachelsenglish.com/english-pronounce-uh-push-vowel/',
  'ɔː': 'https://rachelsenglish.com/english-pronounce-aw-vowel/',
  'ɑː': 'https://rachelsenglish.com/english-pronounce-ah-vowel/',
  'oʊ': 'https://rachelsenglish.com/english-pronounce-oh-diphthong/',
  'eɪ': 'https://rachelsenglish.com/english-pronounce-ay-diphthong/',
  'aɪ': 'https://rachelsenglish.com/english-pronounce-ai-diphthong/',
  'ɔɪ': 'https://rachelsenglish.com/english-pronounce-oy-diphthong/',
  'aʊ': 'https://rachelsenglish.com/english-pronounce-ow-diphthong/',
  'ɑːr': 'https://rachelsenglish.com/pronounce-ar-orn-etc/',
  'ɔːr': 'https://rachelsenglish.com/pronounce-word-2/',
  'ɛər': 'https://rachelsenglish.com/how-to-pronounce-air/',
  'ɪər': 'https://rachelsenglish.com/vowels-ipa-pronunciation-international-phonetic-alphabet/',
  p: 'https://rachelsenglish.com/english-pronounce-b-p-consonants/',
  b: 'https://rachelsenglish.com/english-pronounce-b-p-consonants/',
  t: 'https://rachelsenglish.com/english-pronounce-t-d-consonants/',
  d: 'https://rachelsenglish.com/english-pronounce-t-d-consonants/',
  k: 'https://rachelsenglish.com/english-pronounce-g-k-consonants/',
  g: 'https://rachelsenglish.com/english-pronounce-g-k-consonants/',
  m: 'https://rachelsenglish.com/english-pronounce-m-consonant/',
  n: 'https://rachelsenglish.com/english-pronounce-n-consonant/',
  'ŋ': 'https://rachelsenglish.com/pronounce-n-n-vs-ng-n/',
  f: 'https://rachelsenglish.com/english-pronounce-f-v-consonants/',
  v: 'https://rachelsenglish.com/english-pronounce-f-v-consonants/',
  'θ': 'https://rachelsenglish.com/english-pronounce-th-consonants/',
  'ð': 'https://rachelsenglish.com/english-pronounce-th-consonants/',
  s: 'https://rachelsenglish.com/english-pronounce-s-z-consonants/',
  z: 'https://rachelsenglish.com/english-pronounce-s-z-consonants/',
  'ʃ': 'https://rachelsenglish.com/english-pronounce-sh-zh-consonants/',
  'ʒ': 'https://rachelsenglish.com/english-pronounce-sh-zh-consonants/',
  h: 'https://rachelsenglish.com/english-pronounce-h-consonant/',
  r: 'https://rachelsenglish.com/5-tips-for-r-in-american-english/',
  j: 'https://rachelsenglish.com/english-pronounce-y-consonant/',
  w: 'https://rachelsenglish.com/pronounce-w-consonant/',
  l: 'https://rachelsenglish.com/english-pronounce-l-consonant/',
  'tʃ': 'https://rachelsenglish.com/english-pronounce-ch-jj-sounds/',
  'dʒ': 'https://rachelsenglish.com/english-pronounce-ch-jj-sounds/',
  'ɾ': 'https://rachelsenglish.com/t-pronunciations/',
}

const LANG_CONFIG = {
  en: { label: '🇺🇸 EN', sounds: SOUNDS, vowelGroups: VOWEL_GROUPS, consonantGroups: CONSONANT_GROUPS, azureCode: 'en-US', subtitle: '48 âm chuẩn tiếng Anh' },
  es: { label: '🇪🇸 ES', sounds: SPANISH_SOUNDS, vowelGroups: SPANISH_VOWEL_GROUPS, consonantGroups: SPANISH_CONSONANT_GROUPS, azureCode: 'es-ES', subtitle: 'Tiếng Tây Ban Nha' },
  it: { label: '🇮🇹 IT', sounds: ITALIAN_SOUNDS, vowelGroups: ITALIAN_VOWEL_GROUPS, consonantGroups: ITALIAN_CONSONANT_GROUPS, azureCode: 'it-IT', subtitle: 'Tiếng Ý' },
  fr: { label: '🇫🇷 FR', sounds: FRENCH_SOUNDS, vowelGroups: FRENCH_VOWEL_GROUPS, consonantGroups: FRENCH_CONSONANT_GROUPS, azureCode: 'fr-FR', subtitle: 'Tiếng Pháp' },
}

function rachelYouTubeSearch(label) {
  return `https://www.youtube.com/results?search_query=rachel%27s+english+${encodeURIComponent(label)}+sound`
}

export function SoundLibraryScreen({ lang, onSelectSound, onChangeLang }) {
  const [tab, setTab] = useState('vowels')
  const cfg = LANG_CONFIG[lang]
  const groups = tab === 'vowels' ? cfg.vowelGroups : cfg.consonantGroups
  const sounds = cfg.sounds.filter(s => tab === 'vowels' ? s.type === 'vowel' : s.type === 'consonant')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-10 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Sound Library</h1>
            <p className="text-white/40 text-sm">{cfg.subtitle}</p>
          </div>
          <AzureUsageBadge />
        </div>
        <div className="flex gap-2 mt-3">
          {Object.entries(LANG_CONFIG).map(([key, c]) => (
            <button key={key} onClick={() => { onChangeLang(key); setTab('vowels') }}
              className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-all ${lang === key ? 'bg-white text-gray-900' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mb-4 flex gap-2">
        {['vowels','consonants'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-2xl font-semibold text-sm transition-all ${tab === t ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
            {t === 'vowels'
              ? `Nguyên Âm (${cfg.sounds.filter(s=>s.type==='vowel').length})`
              : `Phụ Âm (${cfg.sounds.filter(s=>s.type==='consonant').length})`}
          </button>
        ))}
      </div>

      {groups.map(g => {
        const groupSounds = sounds.filter(s => s.group === g.key)
        if (!groupSounds.length) return null
        return (
          <div key={g.key} className="mb-6">
            <div className="px-4 mb-3 flex items-center gap-2">
              <span className="text-white/80 font-semibold text-sm">{g.label}</span>
              <span className="text-white/30 text-xs">{groupSounds.length} âm</span>
            </div>
            <div className="px-4 grid grid-cols-4 gap-2">
              {groupSounds.map(s => (
                <button key={s.id} onClick={() => onSelectSound(s)}
                  className={`relative rounded-2xl p-3 flex flex-col items-center gap-1 bg-gradient-to-b ${s.grad} active:scale-95 transition-transform shadow-lg`}>
                  <span className="text-white font-bold text-base">{s.label}</span>
                  <span className="text-white/60 font-mono text-xs">/{s.ipa}/</span>
                  {s.hard && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SoundDetailScreen({ sound, lang, onBack, onPracticeWord }) {
  const azureCode = LANG_CONFIG[lang]?.azureCode || 'en-US'
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">{sound.group}</span>
      </div>

      <div className={`mx-4 rounded-3xl p-6 bg-gradient-to-br ${sound.grad} mb-6`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-5xl font-bold text-white">{sound.label}</div>
            <div className="text-white/70 font-mono text-xl">/{sound.ipa}/</div>
          </div>
          <button onClick={() => speakNeural(sound.words[0].word, azureCode)} className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center active:scale-95 transition-transform">
            <Volume2 size={26} className="text-white" />
          </button>
        </div>
        {sound.hard && <span className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs rounded-lg px-2 py-0.5">★ Khó với người Việt</span>}
        <div className="mt-4 bg-white/10 rounded-2xl p-3">
          <p className="text-white/90 text-sm leading-relaxed">{sound.tip}</p>
        </div>
      </div>

      {lang === 'en' && (
        <div className="px-4 mb-6">
          <div className="text-white/60 text-xs uppercase tracking-wider mb-3 font-semibold">Học thêm</div>
          <div className="flex flex-col gap-2">
            {RACHEL_URLS[sound.ipa] && (
              <a href={RACHEL_URLS[sound.ipa]} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors active:scale-98">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-rose-400 text-xs font-bold">RE</span>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white/80 text-sm font-medium">Rachel's English</div>
                  <div className="text-white/40 text-xs">Hướng dẫn chi tiết âm /{sound.ipa}/</div>
                </div>
                <ExternalLink size={14} className="text-white/30" />
              </a>
            )}
            <a href={rachelYouTubeSearch(sound.label)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors active:scale-98">
              <div className="w-8 h-8 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Play size={14} className="text-red-400 fill-red-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white/80 text-sm font-medium">YouTube — Rachel's English</div>
                <div className="text-white/40 text-xs">Video hướng dẫn âm {sound.label}</div>
              </div>
              <ExternalLink size={14} className="text-white/30" />
            </a>
          </div>
        </div>
      )}

      <div className="px-4">
        <div className="text-white/60 text-xs uppercase tracking-wider mb-3 font-semibold">Luyện tập với từ</div>
        <div className="flex flex-col gap-3">
          {sound.words.map((w, idx) => (
            <button key={w.word} onClick={() => onPracticeWord(w, idx)}
              className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 active:scale-98 hover:bg-white/8 transition-all text-left">
              <div className="flex-1">
                <div className="text-white font-semibold">{w.word}</div>
                <div className="text-white/40 text-sm">{w.meaning}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); speakNeural(w.word, azureCode) }} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Volume2 size={14} className="text-white/60" />
                </button>
                <div className="text-white/20 text-lg">›</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
