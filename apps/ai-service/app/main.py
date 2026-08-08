import asyncio
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("musicflow.ai")

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


@app.post("/api/recommend/retrain")
def retrain_recommendation_model():
    return {
        "success": False,
        "mode": "offline_training",
        "code": "OFFLINE_TRAINING_ONLY",
        "message": "Retrain tự động qua API chưa được bật. Hệ thống hiện sử dụng offline cronjob/script để huấn luyện mô hình.",
        # TODO: Có thể bổ sung background job retraining trong phase sau.
    }


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
        logger.exception("[StemSeparation] callback failed job=%s song=%s: %s", job.job_id, job.song_id, exc)


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


def non_empty_file(path: Path) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size > 0


def atomic_move(src: Path, dst: Path):
    tmp_dst = dst.with_name(f"{dst.stem}.tmp{dst.suffix}")
    if tmp_dst.exists():
        tmp_dst.unlink()
    shutil.move(str(src), str(tmp_dst))
    if not non_empty_file(tmp_dst):
        raise RuntimeError(f"Temporary output is empty: {tmp_dst}")
    os.replace(str(tmp_dst), str(dst))


async def heartbeat_loop(job: StemJobRequest, stop_event: asyncio.Event):
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=45)
        except asyncio.TimeoutError:
            await notify_backend(job, {"status": "processing", "progress": 50, "heartbeat_at": True})


async def run_stem_job(job: StemJobRequest):
    input_path = Path(job.input_audio_path).resolve()
    output_dir = Path(job.output_dir).resolve()

    try:
        logger.info("[StemSeparation] start job=%s song=%s input=%s output=%s", job.job_id, job.song_id, input_path, output_dir)
        await notify_backend(job, {"status": "processing", "progress": 5, "error_message": None})

        if not input_path.exists() or not input_path.is_file():
            raise FileNotFoundError(f"Input audio file not found: {input_path}")

        output_dir.mkdir(parents=True, exist_ok=True)
        for partial_name in ("vocals.tmp.mp3", "instrumental.tmp.mp3", "vocals.mp3.tmp", "instrumental.mp3.tmp"):
            partial_path = output_dir / partial_name
            if partial_path.exists():
                partial_path.unlink()

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

            stop_heartbeat = asyncio.Event()
            heartbeat_task = asyncio.create_task(heartbeat_loop(job, stop_heartbeat))
            try:
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
            finally:
                stop_heartbeat.set()
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass

            await notify_backend(job, {"status": "processing", "progress": 85})

            vocals_src, instrumental_src = find_demucs_outputs(work_dir, input_path)
            if not vocals_src or not instrumental_src or not non_empty_file(vocals_src) or not non_empty_file(instrumental_src):
                raise RuntimeError("Demucs output files were not found")

            vocals_dst = output_dir / "vocals.mp3"
            instrumental_dst = output_dir / "instrumental.mp3"
            atomic_move(vocals_src, vocals_dst)
            atomic_move(instrumental_src, instrumental_dst)

            if not non_empty_file(vocals_dst) or not non_empty_file(instrumental_dst):
                raise RuntimeError("Final stem files are incomplete")

        await notify_backend(job, {
            "status": "completed",
            "progress": 100,
            "vocals_url": job.vocals_url,
            "instrumental_url": job.instrumental_url,
            "error_message": None,
        })
        logger.info("[StemSeparation] completed job=%s song=%s", job.job_id, job.song_id)
    except Exception as exc:
        logger.exception("[StemSeparation] failed job=%s song=%s", job.job_id, job.song_id)
        await notify_backend(job, {
            "status": "failed",
            "progress": 0,
            "error_message": str(exc)[:1000],
        })


@app.post("/api/stem/jobs")
async def create_stem_job(job: StemJobRequest, background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(run_stem_job, job)
        logger.info("[StemSeparation] accepted job=%s song=%s", job.job_id, job.song_id)
        return {
            "success": True,
            "data": {
                "job_id": job.job_id,
                "status": "queued",
            },
        }
    except Exception as exc:
        logger.exception("[StemSeparation] failed to accept job")
        raise HTTPException(status_code=500, detail=str(exc))


from app.api import audio_features
app.include_router(audio_features.router)

@app.api_route("/api/playlist/{path:path}", methods=["GET", "POST"], status_code=501)
def playlist_not_ready(path: str = ""):
    return feature_not_ready()
