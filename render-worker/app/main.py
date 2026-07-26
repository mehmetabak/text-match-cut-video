from fastapi import FastAPI, HTTPException, Security, Depends, BackgroundTasks
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import Dict, Any
import time

from app.core.config import settings

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

def process_video_task(job_id: str, video_url: str, params: dict):
    print(f"[{job_id}] Started processing video from {video_url}")
    # Simulate processing
    time.sleep(5)
    print(f"[{job_id}] Finished processing.")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Render Worker API is running (Celery-free)"}

@app.post("/jobs")
def create_job(request: JobRequest, background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    # Dispatch Background Task instead of Celery to save RAM and money
    background_tasks.add_task(process_video_task, request.job_id, request.video_url, request.params)
    
    return {
        "status": "accepted",
        "job_id": request.job_id,
        "message": "Processing started in background"
    }
