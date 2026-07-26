import asyncio
import json
import base64
import time
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Security, Depends, BackgroundTasks
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

import firebase_admin
from firebase_admin import credentials, firestore

from app.core.config import settings

# --- Firebase Initialization ---
def init_firebase():
    if not firebase_admin._apps:
        try:
            if not settings.FIREBASE_PROJECT_ID:
                print("WARNING: FIREBASE_PROJECT_ID is not set. Firestore will not work.")
                return None

            # Render might escape newlines in env vars, so we fix them
            private_key = settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n')
            # Remove any surrounding quotes if they got copied
            if private_key.startswith('"') and private_key.endswith('"'):
                private_key = private_key[1:-1]

            cred_dict = {
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key": private_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token"
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully.")
            return firestore.client()
        except Exception as e:
            print(f"ERROR initializing Firebase: {e}")
            return None
    return firestore.client()

db = init_firebase()

# --- FastAPI App ---
app = FastAPI(title=settings.PROJECT_NAME)
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header != f"Bearer {settings.WORKER_API_KEY}":
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key_header

# Global lock to ensure ONLY ONE video is processed at a time (prevent OOM)
worker_lock = asyncio.Lock()

# --- Firestore Queue Processing Logic ---
async def process_queue():
    """
    Core function that pulls jobs from Firestore and processes them sequentially.
    Never processes more than one job at a time.
    """
    if worker_lock.locked():
        # Another background task is already processing the queue.
        # Just return, that task will eventually pick up all pending jobs.
        print("Queue is already being processed. Ping ignored.")
        return

    if not db:
        print("Firestore not initialized. Cannot process queue.")
        return

    async with worker_lock:
        print("Worker lock acquired. Starting queue processor...")
        
        while True:
            # 1. Get the oldest pending job
            # We use created_at to process in order (FIFO)
            query = db.collection('render_jobs').where('status', '==', 'pending').order_by('created_at').limit(1)
            docs = query.stream()
            
            job_doc = None
            for doc in docs:
                job_doc = doc
                break
                
            if not job_doc:
                print("Queue is empty. Worker going to sleep.")
                break # Exit the while loop
                
            job_id = job_doc.id
            job_data = job_doc.to_dict()
            video_url = job_data.get('video_url', 'unknown_url')
            
            print(f"[{job_id}] Pulled from queue. Starting processing...")
            
            # 2. Mark as processing
            try:
                db.collection('render_jobs').document(job_id).update({
                    'status': 'processing',
                    'started_at': firestore.SERVER_TIMESTAMP
                })
            except Exception as e:
                print(f"[{job_id}] Failed to update status to processing: {e}")
                continue # Skip to next job
                
            # 3. DO THE HEAVY WORK (FFmpeg/OpenCV)
            try:
                # Simulate heavy processing (FFmpeg call goes here)
                await asyncio.sleep(5) 
                
                # 4. Mark as completed
                db.collection('render_jobs').document(job_id).update({
                    'status': 'completed',
                    'completed_at': firestore.SERVER_TIMESTAMP,
                    'result_url': 'simulated_firebase_storage_url_here'
                })
                print(f"[{job_id}] Processing SUCCESSFUL.")
                
            except Exception as e:
                # Mark as failed
                print(f"[{job_id}] Processing FAILED: {e}")
                db.collection('render_jobs').document(job_id).update({
                    'status': 'failed',
                    'error_message': str(e),
                    'completed_at': firestore.SERVER_TIMESTAMP
                })

# --- Endpoints ---
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Render Worker API is running (Firestore Queue Active)"}

@app.post("/jobs/ping")
def ping_queue(background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    """
    Endpoint triggered by Frontend/Vercel after adding a job to Firestore.
    It simply wakes up the queue processor if it's sleeping.
    """
    background_tasks.add_task(process_queue)
    return {
        "status": "accepted",
        "message": "Ping received. Worker will check Firestore queue."
    }
