from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.audio_feature_extractor import extract_audio_features

router = APIRouter(prefix="/api/audio", tags=["Audio Analysis"])

class AnalyzeRequest(BaseModel):
    file_path: str = Field(..., description="Absolute path to the audio file")

@router.post("/analyze")
def analyze_audio(request: AnalyzeRequest):
    result = extract_audio_features(request.file_path)
    if not result.get("success"):
        # We return 400 for file not found or unsupported audio so it doesn't retry as a server error,
        # but the module returns "success": False, we can just return standard 200 with success=False
        return result
    return result
