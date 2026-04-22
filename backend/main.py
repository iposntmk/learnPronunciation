import os
import json
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from scorer import load_models, score_word


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()   # preload all models at startup
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/score")
async def score_pronunciation(
    audio: UploadFile,
    word: str = Form(...),
    target_ipa: str = Form(...),
):
    ipa_list: list[str] = json.loads(target_ipa)
    if not ipa_list or not word.strip():
        raise HTTPException(400, "Missing word or target_ipa")

    suffix = os.path.splitext(audio.filename or "rec.webm")[1] or ".webm"
    audio_bytes = await audio.read()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp = f.name

    try:
        result = score_word(tmp, word.strip().lower(), ipa_list)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        os.unlink(tmp)
