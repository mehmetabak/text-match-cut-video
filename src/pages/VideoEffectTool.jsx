import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';

export default function VideoEffectTool() {
  const { type } = useParams();
  const lang = useSettingsStore(state => state.lang);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const fileInputRef = useRef(null);
  
  // Desteklenen tipler
  const validTypes = ['ken-burns', 'vhs-tape'];
  
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setErrorMsg('');
      setResultUrl('');
    }
  };

  const startProcessing = async () => {
    if (!file) return;
    if (!auth.currentUser) {
      setErrorMsg('Lütfen giriş yapın (Please log in).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('Maksimum dosya boyutu 50MB olabilir.');
      return;
    }

    try {
      setStatus('uploading');
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Çevresel değişkenlerden backend URL'ini al
      const apiUrl = import.meta.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
      
      // 1. Videoyu doğrudan Backend'e (Render'a) yükle
      const uploadRes = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Upload failed on server (Code: ${uploadRes.status}).`);
      }
      
      const uploadData = await uploadRes.json();
      const jobId = uploadData.job_id;
      
      // 2. Firestore'da job_id ile bir görev oluştur
      setStatus('processing');
      const jobRef = doc(db, 'render_jobs', jobId);
      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        tool_type: type,
        status: 'pending',
        created_at: serverTimestamp(),
        params: {}
      });
      
      // 3. Backend kuyruğu artık upload işlemiyle otomatik tetikleniyor.
      // (Eski /jobs/ping isteği kaldırıldı)
      
      // 4. Durumu Firestore üzerinden dinle
      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'completed') {
             // Backend bize `/download/jobId` formatında bir relative path dönüyor
             setResultUrl(`${apiUrl}${data.result_url}`);
             setStatus('completed');
             unsubscribe();
          } else if (data.status === 'failed') {
             setErrorMsg(data.error_message || 'Processing failed.');
             setStatus('error');
             unsubscribe();
          }
        }
      });
      
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Bir hata oluştu.');
      setStatus('error');
    }
  };

  const effectTitle = type ? type.replace('-', ' ').toUpperCase() : '';

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 relative z-10 min-h-[calc(100vh-80px)] text-white">
      <h1 className="text-4xl font-black mb-2 uppercase">{effectTitle} Effect</h1>
      <p className="text-zinc-400 mb-8">
        Upload a video or image (max 50MB) to apply the {effectTitle} effect. Powered by Render Backend.
      </p>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px]">
        {status === 'idle' || status === 'error' ? (
          <div className="flex flex-col items-center w-full max-w-md">
            
            {/* Sürükle Bırak / Tıkla Alanı */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 hover:bg-zinc-800 transition flex flex-col items-center justify-center rounded-xl cursor-pointer mb-6"
            >
               <svg className="w-12 h-12 text-zinc-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
               <span className="text-zinc-400 font-medium">Click to select a video/image</span>
               <span className="text-zinc-500 text-sm mt-1">Max 50MB</span>
            </div>
            
            <input 
              type="file" 
              accept="video/mp4,video/quicktime,image/jpeg,image/png" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            
            {file && (
               <div className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg flex items-center justify-between mb-6">
                 <div className="truncate text-zinc-300 font-medium">{file.name}</div>
                 <div className="text-zinc-500 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
               </div>
            )}
            
            {file && (
               <button 
                 onClick={startProcessing}
                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] font-bold text-lg transition"
               >
                 Start Processing
               </button>
            )}
            
            {status === 'error' && (
              <div className="mt-6 w-full bg-red-900/30 border border-red-500/50 p-4 rounded-lg text-red-400 text-sm font-medium">
                {errorMsg}
              </div>
            )}
          </div>
          
        ) : status === 'uploading' ? (
          <div className="flex flex-col items-center animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-400 font-bold text-xl">Uploading to Render...</p>
            <p className="text-zinc-500 text-sm mt-2">Sending your file directly to the backend</p>
          </div>
          
        ) : status === 'processing' ? (
          <div className="flex flex-col items-center">
             <div className="w-16 h-16 border-4 border-[#F5B301] border-t-transparent rounded-full animate-spin mb-6"></div>
             <p className="text-[#F5B301] font-bold text-xl">Applying Effect...</p>
             <p className="text-zinc-400 text-sm mt-2">Running isolated job runner on Render. Please wait.</p>
          </div>
          
        ) : status === 'completed' ? (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-2xl font-bold text-green-400 mb-6">Effect Applied Successfully!</h2>
            
            <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden border border-zinc-700 mb-6">
               <video src={resultUrl} controls autoPlay loop className="w-full h-auto max-h-[500px]" />
            </div>
            
            <div className="flex gap-4">
               <a 
                 href={resultUrl} 
                 download 
                 target="_blank" rel="noreferrer"
                 className="px-8 py-3 bg-green-600 hover:bg-green-500 font-bold rounded-lg transition"
               >
                 Download Video
               </a>
               <button 
                 onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); }}
                 className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 font-bold rounded-lg border border-zinc-700 transition"
               >
                 Create Another
               </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
