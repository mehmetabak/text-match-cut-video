import sys
import json
import os
import uuid
import glob
import tempfile
import subprocess
import threading
import time
import re
import queue
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
import firebase_admin

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

firebase_setup_error = None

if not firebase_admin._apps:
    try:
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
            
        firebase_credentials = os.getenv("FIREBASE_CREDENTIALS")
        firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY")
        
        if firebase_credentials:
            try:
                # Try parsing as JSON string
                cred_dict = json.loads(firebase_credentials)
                cred = credentials.Certificate(cred_dict)
            except ValueError:
                # If not valid JSON, treat it as a file path (common for Render Secret Files)
                cred = credentials.Certificate(firebase_credentials)
            firebase_admin.initialize_app(cred)
        elif firebase_private_key:
            cred_dict = {
                "type": "service_account",
                "project_id": os.getenv("FIREBASE_PROJECT_ID", ""),
                "private_key": firebase_private_key.replace("\\n", "\n"),
                "client_email": os.getenv("FIREBASE_CLIENT_EMAIL", ""),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        else:
            firebase_setup_error = "FIREBASE_CREDENTIALS veya FIREBASE_PRIVATE_KEY bulunamadi."
            print(firebase_setup_error)
    except Exception as e:
        firebase_setup_error = f"Firebase setup error: {str(e)}"
        print(firebase_setup_error)

try:
    db = firestore.client()
except Exception as e:
    if firebase_setup_error is None:
        firebase_setup_error = f"Firestore client init error: {str(e)}"
    print(firebase_setup_error)
    db = None

TEMP_DIR = tempfile.gettempdir()
worker_lock = threading.Lock()

ALLOWED_TOOL_TYPES = {"ken-burns", "vhs-tape"}
MAX_INPUT_MB = 100
MAX_DURATION_SEC = 210
MAX_RETRIES = 2
JOB_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")

def sanitize_job_id(job_id: str) -> str:
    if not JOB_ID_RE.match(job_id):
        raise ValueError("Gecersiz job_id")
    return job_id

def check_file_size(path: str):
    size_mb = os.path.getsize(path) / (1024 * 1024)
    if size_mb > MAX_INPUT_MB:
        raise ValueError(f"Kaynak dosya {size_mb:.1f}MB, sinir {MAX_INPUT_MB}MB")

def validate_media_file(path: str):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, timeout=15,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise ValueError("Gecersiz veya bozuk medya dosyasi")

def cleanup_job_files(job_id: str):
    for path in glob.glob(os.path.join(TEMP_DIR, f"{job_id}_*")):
        try:
            os.remove(path)
        except OSError:
            pass

def cleanup_orphans(max_age_hours: float = 2):
    now = time.time()
    for path in glob.glob(os.path.join(TEMP_DIR, "*_input.*")) + \
                glob.glob(os.path.join(TEMP_DIR, "*_output.mp4")) + \
                glob.glob(os.path.join(TEMP_DIR, "*_scanline.png")):
        try:
            if now - os.path.getmtime(path) > max_age_hours * 3600:
                os.remove(path)
        except OSError:
            pass

def run_isolated_job(job_id, tool_type, input_path, output_path, params, timeout_sec, job_ref):
    runner_path = os.path.join(os.path.dirname(__file__), "job_runner.py")
    cmd = [sys.executable, runner_path, job_id, tool_type, input_path, output_path, json.dumps(params)]
    
    # Redirect stderr to stdout so we read everything from a single pipe and avoid deadlocks
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    start_time = time.time()
    last_update_time = 0
    last_progress = 0
    
    q = queue.Queue()
    
    def enqueue_output(out, q):
        for line in iter(out.readline, ''):
            q.put(line)
        out.close()
        
    t = threading.Thread(target=enqueue_output, args=(process.stdout, q))
    t.daemon = True
    t.start()
    
    output_lines = []
    
    while True:
        if time.time() - start_time > timeout_sec:
            process.kill()
            return False, f"Islem {timeout_sec} sn icinde tamamlanamadi (timeout)"
        
        try:
            line = q.get(timeout=1.0).strip()
            output_lines.append(line)
            if len(output_lines) > 200:
                output_lines.pop(0) # Keep only last 200 lines to save memory
                
            if line.startswith("PROGRESS:"):
                try:
                    progress = int(line.split(":")[1])
                    now = time.time()
                    if (progress - last_progress >= 5) or (now - last_update_time > 2.0):
                        if db:
                            job_ref.update({'progress': progress})
                        last_progress = progress
                        last_update_time = now
                except ValueError:
                    pass
        except queue.Empty:
            pass
            
        if process.poll() is not None:
            break
            
    while not q.empty():
        line = q.get().strip()
        output_lines.append(line)
        if len(output_lines) > 200:
            output_lines.pop(0)
        
    stderr_output = "\n".join(output_lines)
    
    if process.returncode == 0:
        return True, None
    if process.returncode == 2:
        return False, "Bellek limiti asildi"
    if process.returncode in (-9, 137):
        return False, "Alt-surec OOM Killer tarafindan sonlandirildi"
    return False, stderr_output[-1500:]

def process_queue():
    if not worker_lock.acquire(blocking=False):
        return
    try:
        cleanup_orphans()
        while True:
            if not db:
                break
                
            query = db.collection('render_jobs').where('status', '==', 'pending').limit(1)
            docs = list(query.stream())
            if not docs:
                break

            job_doc = docs[0]
            job_ref = db.collection('render_jobs').document(job_doc.id)
            job_data = job_doc.to_dict()

            try:
                job_id = sanitize_job_id(job_doc.id)
            except ValueError as e:
                job_ref.update({'status': 'failed', 'error_message': str(e)})
                continue

            tool_type = job_data.get('tool_type')
            if tool_type not in ALLOWED_TOOL_TYPES:
                job_ref.update({'status': 'failed', 'error_message': 'Desteklenmeyen arac tipi'})
                continue

            job_ref.update({'status': 'processing', 'progress': 0})

            matches = glob.glob(os.path.join(TEMP_DIR, f"{job_id}_input.*"))
            output_path = os.path.join(TEMP_DIR, f"{job_id}_output.mp4")

            try:
                if not matches:
                    raise FileNotFoundError("Girdi dosyasi bulunamadi")
                input_path = matches[0]

                check_file_size(input_path)
                validate_media_file(input_path)

                ok, err = run_isolated_job(
                    job_id, tool_type, input_path, output_path,
                    params=job_data.get('params', {}),
                    timeout_sec=900,
                    job_ref=job_ref
                )
                if not ok:
                    raise RuntimeError(err)

                job_ref.update({'status': 'completed', 'progress': 100, 'result_url': f"/download/{job_id}"})

            except Exception as e:
                retry_count = job_data.get('retry_count', 0)
                if retry_count < MAX_RETRIES:
                    job_ref.update({'status': 'pending', 'retry_count': retry_count + 1})
                else:
                    err_msg = str(e)
                    print(f"[job {job_id}] FAILED: {err_msg}")
                    job_ref.update({'status': 'failed', 'error_message': err_msg})

            finally:
                cleanup_job_files(job_id)
    finally:
        worker_lock.release()

@app.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, tool_type: str, file: UploadFile = File(...), params: str = Form("{}"), uid: str = Form("")):
    try:
        if not db:
            raise Exception(f"Firestore baglantisi yok. Sebep: {firebase_setup_error}")

        job_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".mp4"
        input_path = os.path.join(TEMP_DIR, f"{job_id}_input{ext}")

        with open(input_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)

        job_data = {
            "uid": uid,
            "tool_type": tool_type,
            "status": "pending",
            "params": json.loads(params),
            "created_at": firestore.SERVER_TIMESTAMP,
            "result_url": None,
            "error_message": None,
            "progress": 0,
            "retry_count": 0
        }
        db.collection('render_jobs').document(job_id).set(job_data)

        background_tasks.add_task(process_queue)
        return {"job_id": job_id, "status": "pending"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Sunucu hatasi: {str(e)}")

@app.get("/download/{job_id}")
async def download_result(job_id: str):
    output_path = os.path.join(TEMP_DIR, f"{job_id}_output.mp4")
    if os.path.exists(output_path):
        return FileResponse(output_path, media_type="video/mp4", filename=f"processed_{job_id}.mp4")
    return {"error": "Dosya bulunamadi veya suresi doldu"}
