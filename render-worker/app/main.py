from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import Dict, Any

from app.core.config import settings
from app.workers.tasks import process_video

app = FastAPI(title=settings.PROJECT_NAME)

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header != f"Bearer {settings.WORKER_API_KEY}":
        raise HTTPException(
            status_code=403, detail="Could not validate credentials"
        )
    return api_key_header

class JobRequest(BaseModel):
    job_id: str
    video_url: str
    params: Dict[str, Any]

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Render Worker API is running."}

@app.post("/jobs")
def create_job(request: JobRequest, api_key: str = Depends(get_api_key)):
    """
    Endpoint triggered by Vercel frontend/backend to start a video processing job.
    """
    # Dispatch Celery Task
    task = process_video.delay(request.job_id, request.video_url, request.params)
    
    return {
        "status": "accepted",
        "job_id": request.job_id,
        "task_id": task.id
    }
