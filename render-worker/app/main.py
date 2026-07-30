import asyncio
import json
import os
import re
import sys
import time
import uuid
import glob
import tempfile
import subprocess
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Security, Depends, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials, firestore

from app.core.config import settings
import threading

TEMP_DIR = tempfile.gettempdir()
MAX_INPUT_MB = 50
ALLOWED_TOOL_TYPES = {"ken-burns", "vhs-tape"}
MAX_RETRY = 2

# UUID hex pattern for job_id sanitization
JOB_ID_RE = re.compile(r'^[a-f0-9]{32}$')

# --- Firebase Initialization ---
def init_firebase():
    if not firebase_admin._apps:
        try:
            if not settings.FIREBASE_PROJECT_ID:
                print("WARNING: FIREBASE_PROJECT_ID is not set. Firestore will not work.")
                return None

            private_key = settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n')
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header != f"Bearer {settings.WORKER_API_KEY}":
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key_header


worker_lock = threading.Lock()

def cleanup_orphans(max_age_hours: float = 2):
    """Worker başlangıcında çalıştır: eski/öksüz dosyaları temizle"""
    now = time.time()
    patterns = [
        os.path.join(TEMP_DIR, "*_input.*"),
        os.path.join(TEMP_DIR, "*_output.mp4")
    ]
    for pattern in patterns:
        for path in glob.glob(pattern):
            try:
                if now - os.path.getmtime(path) > max_age_hours * 3600:
                    os.remove(path)
            except OSError:
                pass

def run_isolated_job(job_id, tool_type, input_path, output_path, params, timeout=900):
    runner_path = os.path.join(os.path.dirname(__file__), "job_runner.py")
    cmd = [sys.executable, runner_path, job_id, tool_type, input_path, output_path, json.dumps(params)]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=timeout, text=True)
    except subprocess.TimeoutExpired:
        return False, f"İşlem {timeout} sn içinde tamamlanamadı (timeout)"

    if result.returncode == 0:
        return True, None
    if result.returncode == 2:
        return False, "Bellek limiti aşıldı (izole alt-süreç koruması devreye girdi)"
    if result.returncode in (-9, 137):
        return False, "Alt-süreç kernel OOM Killer tarafından sonlandırıldı"
    return False, (result.stderr or "")[-1500:]

def process_queue():
    if not worker_lock.acquire(blocking=False):
        print("Queue is already being processed. Ping ignored.")
        return

    try:
        if not db:
            print("Firestore not initialized. Cannot process queue.")
            return

        cleanup_orphans()
        print("Worker lock acquired. Starting queue processor...")
        
        while True:
            query = db.collection('render_jobs').where('status', '==', 'pending').limit(1)
            docs = list(query.stream())
                
            if not docs:
                print("Queue is empty. Worker going to sleep.")
                break
                
            job_doc = docs[0]
            job_id = job_doc.id
            job_data = job_doc.to_dict()

            # --- Per-job isolated try/except ---
            try:
                # job_id sanitizasyonu: sadece hex UUID kabul et (path traversal koruması)
                if not JOB_ID_RE.match(job_id):
                    print(f"[{job_id}] SECURITY: Invalid job_id format, skipping.")
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'failed',
                        'error_message': 'Geçersiz job_id formatı.'
                    })
                    continue

                tool_type = job_data.get('tool_type')
                retry_count = job_data.get('retry_count', 0)
                
                print(f"[{job_id}] Pulled from queue. Starting processing... (retry: {retry_count})")
                
                if tool_type not in ALLOWED_TOOL_TYPES:
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'failed',
                        'error_message': f'Unsupported tool_type: {tool_type}'
                    })
                    continue

                matches = glob.glob(os.path.join(TEMP_DIR, f"{job_id}_input.*"))
                
                if not matches:
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'failed',
                        'error_message': 'Uploaded file not found on server.'
                    })
                    continue
                    
                input_path = matches[0]
                output_path = os.path.join(TEMP_DIR, f"{job_id}_output.mp4")
                
                try:
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'processing',
                        'started_at': firestore.SERVER_TIMESTAMP
                    })
                except Exception as e:
                    print(f"[{job_id}] Failed to update status to processing: {e}")
                    continue
                    
                params = job_data.get('params', {})
                
                ok, err = run_isolated_job(job_id, tool_type, input_path, output_path, params)
                
                if ok and os.path.exists(output_path):
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'completed',
                        'completed_at': firestore.SERVER_TIMESTAMP,
                        'result_url': f"/download/{job_id}"
                    })
                    print(f"[{job_id}] Processing SUCCESSFUL.")
                    # Başarılı → input dosyasını hemen sil
                    if os.path.exists(input_path):
                        try:
                            os.remove(input_path)
                        except OSError:
                            pass
                else:
                    # Auto-retry: henüz max denemeye ulaşılmadıysa tekrar kuyruğa al
                    if retry_count < MAX_RETRY:
                        db.collection('render_jobs').document(job_id).update({
                            'status': 'pending',
                            'retry_count': retry_count + 1,
                            'last_error': err or "Bilinmeyen Hata"
                        })
                        print(f"[{job_id}] Processing FAILED, retrying ({retry_count + 1}/{MAX_RETRY}): {err}")
                    else:
                        db.collection('render_jobs').document(job_id).update({
                            'status': 'failed',
                            'error_message': err or "Bilinmeyen Hata",
                            'completed_at': firestore.SERVER_TIMESTAMP
                        })
                        print(f"[{job_id}] Processing FAILED (max retries reached): {err}")
                        # Başarısız → input dosyasını SİLME (debugging için bırak, cleanup_orphans 2 saat sonra temizler)

            except Exception as job_err:
                # Tek bir bozuk job tüm kuyruğu durduramaz
                print(f"[{job_id}] UNEXPECTED ERROR in job processing: {job_err}")
                try:
                    db.collection('render_jobs').document(job_id).update({
                        'status': 'failed',
                        'error_message': f'Beklenmeyen sunucu hatası: {str(job_err)[:500]}'
                    })
                except Exception:
                    pass

    finally:
        worker_lock.release()


# --- Endpoints ---
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Render Worker API is running (Firestore Queue Active)"}

@app.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Frontend buraya video yükler, dönen job_id'yi Firestore'a yazar"""
    job_id = uuid.uuid4().hex
    
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".mp4"
    if ext not in [".mp4", ".mov", ".avi", ".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".mp4"
        
    input_path = os.path.join(TEMP_DIR, f"{job_id}_input{ext}")
    
    with open(input_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)
            
    size_mb = os.path.getsize(input_path) / (1024 * 1024)
    if size_mb > MAX_INPUT_MB:
        os.remove(input_path)
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_INPUT_MB}MB.")
        
    # Arka planda kuyruğu tetikle
    background_tasks.add_task(process_queue)
        
    return {"job_id": job_id, "status": "uploaded"}

@app.get("/download/{job_id}")
def download_video(job_id: str):
    """Frontend renderlanmış videoyu buradan indirir"""
    # Sanitize job_id before using in file path
    if not JOB_ID_RE.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")
    output_path = os.path.join(TEMP_DIR, f"{job_id}_output.mp4")
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="File not found or already deleted/downloaded.")
        
    return FileResponse(output_path, media_type="video/mp4", filename=f"{job_id}_processed.mp4")

@app.post("/jobs/ping")
def ping_queue(background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    background_tasks.add_task(process_queue)
    return {
        "status": "accepted",
        "message": "Ping received. Worker will check Firestore queue."
    }
