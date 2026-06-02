from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


@app.api_route("/api/stem/{path:path}", methods=["GET", "POST"], status_code=501)
def stem_not_ready(path: str = ""):
    return feature_not_ready()


@app.api_route("/api/playlist/{path:path}", methods=["GET", "POST"], status_code=501)
def playlist_not_ready(path: str = ""):
    return feature_not_ready()
