import requests
import time
import os
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore

# Load local .env
load_dotenv('.env')

# 1. Initialize Firebase
cred = credentials.Certificate({
    "type": "service_account",
    "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
    "private_key": os.environ.get("FIREBASE_PRIVATE_KEY").replace('\\n', '\n').strip('"'),
    "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
    "token_uri": "https://oauth2.googleapis.com/token"
})
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

print("1. Adding dummy job to Firestore...")
job_ref = db.collection('render_jobs').document()
job_ref.set({
    'status': 'pending',
    'video_url': 'https://example.com/test_video.mp4',
    'created_at': firestore.SERVER_TIMESTAMP
})
print(f"   Job added with ID: {job_ref.id}")

print("\n2. Pinging Render Server...")
API_URL = os.environ.get("RENDER_API_URL", "https://matchcut-api.onrender.com")
API_KEY = os.environ.get("RENDER_API_KEY")

try:
    res = requests.post(
        f"{API_URL}/jobs/ping",
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    print(f"   Ping Response: {res.status_code} - {res.text}")
except Exception as e:
    print(f"   Failed to ping Render: {e}")

print("\n3. Waiting 3 seconds and checking Firestore status...")
time.sleep(3)
doc = job_ref.get()
print(f"   Current Job Status: {doc.to_dict().get('status')}")

print("\n4. Waiting 6 more seconds (total 9s) for job to complete...")
time.sleep(6)
doc = job_ref.get()
final_status = doc.to_dict().get('status')
print(f"   Final Job Status: {final_status}")
if final_status == 'completed':
    print("\n✅ TEST SUCCESSFUL! The entire pipeline works perfectly.")
else:
    print("\n❌ TEST FAILED. Check Render logs.")
