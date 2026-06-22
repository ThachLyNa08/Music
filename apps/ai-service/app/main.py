import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import httpx
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="MusicFlow AI Service",
    description="Recommendation Engine + Stem Separation + AI Playlist",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def feature_not_ready():
    return {
        "success": False,
        "code": "FEATURE_NOT_READY",
        "message": "AI service endpoint is not implemented yet.",
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "musicflow-ai"}


@app.post("/api/recommend/retrain", status_code=501)
def retrain_recommendation_model():
    return feature_not_ready()


class StemJobRequest(BaseModel):
    job_id: int = Field(gt=0)
    user_id: int = Field(gt=0)
    song_id: int = Field(gt=0)
    input_audio_path: str
    output_dir: str
    vocals_url: str
    instrumental_url: str
    callback_url: str
    callback_token: str = ""


async def notify_backend(job: StemJobRequest, payload: dict):
    headers = {}
    if job.callback_token:
        headers["x-stem-callback-token"] = job.callback_token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(job.callback_url, json=payload, headers=headers)
    except Exception as exc:
        print(f"[stem] callback failed for job {job.job_id}: {exc}")


def find_demucs_outputs(work_dir: Path, input_path: Path):
    model_dir = work_dir / "htdemucs"
    candidates = list(model_dir.glob("*/vocals.mp3"))
    if not candidates:
        candidates = list(work_dir.glob("**/vocals.mp3"))
    vocals = candidates[0] if candidates else None

    instrumental = None
    if vocals:
        no_vocals = vocals.parent / "no_vocals.mp3"
        if no_vocals.exists():
            instrumental = no_vocals

    if not instrumental:
        matches = list(work_dir.glob("**/no_vocals.mp3"))
        instrumental = matches[0] if matches else None

    return vocals, instrumental


async def run_stem_job(job: StemJobRequest):
    input_path = Path(job.input_audio_path).resolve()
    output_dir = Path(job.output_dir).resolve()

    try:
        await notify_backend(job, {"status": "processing", "progress": 5, "error_message": None})

        if not input_path.exists() or not input_path.is_file():
            raise FileNotFoundError(f"Input audio file not found: {input_path}")

        output_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(prefix=f"musicflow_stem_{job.job_id}_") as tmp:
            work_dir = Path(tmp)
            input_ext = input_path.suffix.lower()
            if input_ext not in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}:
                input_ext = ".mp3"
            safe_input = work_dir / f"input{input_ext}"
            shutil.copy2(str(input_path), str(safe_input))

            env = os.environ.copy()
            env["PYTHONUTF8"] = "1"
            env["PYTHONIOENCODING"] = "utf-8"

            await notify_backend(job, {"status": "processing", "progress": 15})

            command = [
                sys.executable,
                "-m",
                "demucs",
                "--two-stems=vocals",
                "-n",
                os.getenv("DEMUCS_MODEL", "htdemucs"),
                "--mp3",
                "--out",
                str(work_dir),
                str(safe_input),
            ]

            result = await asyncio.to_thread(
                subprocess.run,
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
            )
            if result.returncode != 0:
                detail = (result.stderr or result.stdout or "Demucs failed").strip()
                raise RuntimeError(detail[-2000:])

            await notify_backend(job, {"status": "processing", "progress": 85})

            vocals_src, instrumental_src = find_demucs_outputs(work_dir, input_path)
            if not vocals_src or not instrumental_src:
                raise RuntimeError("Demucs output files were not found")

            vocals_dst = output_dir / "vocals.mp3"
            instrumental_dst = output_dir / "instrumental.mp3"
            shutil.move(str(vocals_src), str(vocals_dst))
            shutil.move(str(instrumental_src), str(instrumental_dst))

        await notify_backend(job, {
            "status": "completed",
            "progress": 100,
            "vocals_url": job.vocals_url,
            "instrumental_url": job.instrumental_url,
            "error_message": None,
        })
    except Exception as exc:
        await notify_backend(job, {
            "status": "failed",
            "progress": 0,
            "error_message": str(exc)[:1000],
        })


@app.post("/api/stem/jobs")
async def create_stem_job(job: StemJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_stem_job, job)
    return {
        "success": True,
        "data": {
            "job_id": job.job_id,
            "status": "queued",
        },
    }


from app.api import audio_features
app.include_router(audio_features.router)

@app.api_route("/api/playlist/{path:path}", methods=["GET", "POST"], status_code=501)
def playlist_not_ready(path: str = ""):
    return feature_not_ready()
