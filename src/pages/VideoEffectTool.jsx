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
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const fileInputRef = useRef(null);
  
  const [params, setParams] = useState({
    quality: '720p',
    aspect_ratio: '16:9',
    zoom_direction: 'in',
    pan_style: 'center'
  });
  
  // Desteklenen tipler
  const validTypes = ['ken-burns', 'vhs-tape'];
  
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  // Sanal (Perceived) İlerleme Çubuğu Animasyonu
  useEffect(() => {
    let interval;
    if (status === 'processing' && progress < 15) {
      interval = setInterval(() => {
        setProgress(p => Math.min(p + 1, 15));
      }, 800);
    }
    return () => clearInterval(interval);
  }, [status, progress]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setErrorMsg('');
      setResultUrl('');
      setProgress(0);
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
      setProgress(0);
      
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
        params: params
      });
      
      // 3. Durumu Firestore üzerinden dinle
      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.progress) {
             setProgress(data.progress);
          }
          if (data.status === 'completed') {
             setResultUrl(`${apiUrl}${data.result_url}`);
             setProgress(100);
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
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 relative z-10 min-h-[100dvh] text-white">
      <h1 className="text-4xl font-black mb-2 uppercase">{effectTitle} Effect</h1>
      <p className="text-zinc-400 mb-8">
        Upload a video or image (max 50MB) to apply the {effectTitle} effect. Powered by Render Backend.
      </p>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center min-h-[400px]">
        {status === 'idle' || status === 'error' ? (
          <div className="flex flex-col items-center w-full max-w-xl">
            
            {/* Parameters Grid */}
            <div className="w-full bg-zinc-800/40 backdrop-blur-md border border-zinc-700/50 p-6 rounded-2xl mb-6 flex flex-col gap-4 shadow-lg">
              <h3 className="text-lg font-bold text-zinc-200">Effect Settings</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-400">Quality</label>
                  <select 
                    value={params.quality} 
                    onChange={e => setParams({...params, quality: e.target.value})}
                    className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-2.5 text-white outline-none focus:border-[#F5B301] transition backdrop-blur-sm"
                  >
                    <option value="720p">720p (Fast)</option>
                    <option value="1080p">1080p (Pro - Slower)</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-400">Aspect Ratio</label>
                  <select 
                    value={params.aspect_ratio} 
                    onChange={e => setParams({...params, aspect_ratio: e.target.value})}
                    className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-2.5 text-white outline-none focus:border-[#F5B301] transition backdrop-blur-sm"
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Vertical)</option>
                    <option value="1:1">1:1 (Square)</option>
                  </select>
                </div>

                {type === 'ken-burns' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-400">Zoom Direction</label>
                      <select 
                        value={params.zoom_direction} 
                        onChange={e => setParams({...params, zoom_direction: e.target.value})}
                        className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-2.5 text-white outline-none focus:border-[#F5B301] transition backdrop-blur-sm"
                      >
                        <option value="in">Zoom In</option>
                        <option value="out">Zoom Out</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-400">Pan Style</label>
                      <select 
                        value={params.pan_style} 
                        onChange={e => setParams({...params, pan_style: e.target.value})}
                        className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-2.5 text-white outline-none focus:border-[#F5B301] transition backdrop-blur-sm"
                      >
                        <option value="center">Center</option>
                        <option value="left_to_right">Left to Right</option>
                        <option value="right_to_left">Right to Left</option>
                        <option value="top_to_bottom">Top to Bottom</option>
                        <option value="bottom_to_top">Bottom to Top</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sürükle Bırak / Tıkla Alanı */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/30 hover:bg-zinc-800/50 transition flex flex-col items-center justify-center rounded-2xl cursor-pointer mb-6"
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
               <div className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-xl flex items-center justify-between mb-6 shadow-md">
                 <div className="truncate text-zinc-300 font-medium">{file.name}</div>
                 <div className="text-zinc-500 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
               </div>
            )}
            
            {file && (
               <button 
                 onClick={startProcessing}
                 className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] font-bold text-lg transition transform hover:scale-[1.02]"
               >
                 Start Processing
               </button>
            )}
            
            {status === 'error' && (
              <div className="mt-6 w-full bg-red-900/30 border border-red-500/50 p-4 rounded-xl text-red-400 text-sm font-medium">
                {errorMsg}
              </div>
            )}
          </div>
          
        ) : status === 'uploading' ? (
          <div className="flex flex-col items-center animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            <p className="text-blue-400 font-bold text-xl">Uploading to Render...</p>
            <p className="text-zinc-500 text-sm mt-2">Sending your file directly to the backend</p>
          </div>
          
        ) : status === 'processing' ? (
          <div className="flex flex-col items-center w-full max-w-md">
             <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 mb-6 shadow-[0_0_15px_rgba(245,179,1,0.15)] relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#F5B301] to-orange-500 transition-all duration-500 ease-out absolute left-0 top-0"
                  style={{ width: `${progress}%` }}
                ></div>
             </div>
             <p className="text-[#F5B301] font-black text-4xl mb-2 drop-shadow-md">{progress}%</p>
             <p className="text-zinc-400 text-sm font-medium">Processing in the cloud...</p>
             <p className="text-zinc-600 text-xs mt-1">(Real-time updates enabled)</p>
          </div>
          
        ) : status === 'completed' ? (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-6 drop-shadow-lg">
              Effect Applied Successfully!
            </h2>
            
            <div className="relative w-full max-w-2xl bg-black rounded-2xl overflow-hidden border border-zinc-700 mb-8 shadow-2xl">
               <video src={resultUrl} controls autoPlay loop className="w-full h-auto max-h-[60vh] object-contain" />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
               <a 
                 href={resultUrl} 
                 download 
                 target="_blank" rel="noreferrer"
                 className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.3)] text-center transform hover:scale-[1.02]"
               >
                 Download Video
               </a>
               <button 
                 onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); setProgress(0); }}
                 className="px-8 py-4 bg-zinc-800/80 hover:bg-zinc-700 font-bold rounded-xl border border-zinc-700 transition text-center backdrop-blur-sm"
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
