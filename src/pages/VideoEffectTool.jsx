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
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Effect parameters
  const [zoomDirection, setZoomDirection] = useState('in');
  const [panStyle, setPanStyle] = useState('center');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  
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
      setProgress(0);
    }
  };

  const startProcessing = async () => {
    if (!file) return;
    if (!auth.currentUser) {
      setErrorMsg('Lütfen giriş yapın (Please log in).');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg('Maksimum dosya boyutu 100MB olabilir.');
      return;
    }

    try {
      setStatus('uploading');
      setProgress(0);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const aspectRatioMap = {
        '16:9': { target_width: 1280, target_height: 720 },
        '9:16': { target_width: 720, target_height: 1280 },
        '1:1': { target_width: 1080, target_height: 1080 }
      };

      const params = {};
      if (type === 'ken-burns') {
         params.zoom_direction = zoomDirection;
         params.pan_style = panStyle;
         params.target_width = aspectRatioMap[aspectRatio].target_width;
         params.target_height = aspectRatioMap[aspectRatio].target_height;
      } else if (type === 'vhs-tape') {
         params.target_width = aspectRatioMap[aspectRatio].target_width;
         params.target_height = aspectRatioMap[aspectRatio].target_height;
      }
      
      formData.append('params', JSON.stringify(params));
      
      const apiUrl = import.meta.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
      
      const uploadRes = await fetch(`${apiUrl}/upload?tool_type=${type}`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Upload failed on server (Code: ${uploadRes.status}).`);
      }
      
      const uploadData = await uploadRes.json();
      
      if (uploadData.error) {
         throw new Error(uploadData.error);
      }
      
      const jobId = uploadData.job_id;
      if (!jobId) {
         throw new Error("Sunucudan geçerli bir is kimligi (job ID) alinamadi.");
      }
      
      setStatus('processing');
      const jobRef = doc(db, 'render_jobs', jobId);
      
      // We don't overwrite the doc created by backend, we just listen to it.
      // But we can set it up if it takes time to reach backend (though backend already sets it in POST /upload).
      // So let's just listen.
      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.progress !== undefined) {
             setProgress(data.progress);
          }
          if (data.status === 'completed') {
             setResultUrl(`${apiUrl}${data.result_url}`);
             setStatus('completed');
             unsubscribe();
          } else if (data.status === 'failed') {
             setErrorMsg(data.error_message || 'İşlem başarısız oldu (Processing failed).');
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
        Upload a video or image (max 100MB, 3.5 minutes) to apply the {effectTitle} effect. Powered by native FFmpeg on Render.
      </p>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px]">
        {status === 'idle' || status === 'error' ? (
          <div className="flex flex-col w-full max-w-xl">
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 hover:bg-zinc-800 transition flex flex-col items-center justify-center rounded-xl cursor-pointer mb-6"
            >
               <svg className="w-12 h-12 text-zinc-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
               <span className="text-zinc-400 font-medium">Click to select a video/image</span>
               <span className="text-zinc-500 text-sm mt-1">Max 100MB, 3.5 minutes (210s)</span>
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

            {/* Parameters UI */}
            {file && (
              <div className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-xl mb-6 space-y-4">
                <h3 className="text-lg font-bold text-zinc-200 mb-2 border-b border-zinc-800 pb-2">Effect Parameters</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Aspect Ratio (Format)</label>
                    <select 
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="16:9">16:9 (Landscape - YouTube)</option>
                      <option value="9:16">9:16 (Portrait - TikTok/Reels)</option>
                      <option value="1:1">1:1 (Square - Instagram)</option>
                    </select>
                  </div>
                  
                  {type === 'ken-burns' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Zoom Direction</label>
                        <select 
                          value={zoomDirection}
                          onChange={(e) => setZoomDirection(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="in">Zoom In</option>
                          <option value="out">Zoom Out</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Pan Style (Movement)</label>
                        <select 
                          value={panStyle}
                          onChange={(e) => setPanStyle(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="center">Center</option>
                          <option value="left-to-right">Left to Right</option>
                          <option value="right-to-left">Right to Left</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
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
          <div className="flex flex-col items-center w-full max-w-md">
             <div className="w-16 h-16 border-4 border-[#F5B301] border-t-transparent rounded-full animate-spin mb-6"></div>
             <p className="text-[#F5B301] font-bold text-xl">Applying Effect...</p>
             <p className="text-zinc-400 text-sm mt-2 mb-6">Processing video with native FFmpeg. This may take up to 3.5 minutes.</p>
             
             {/* Real-time Progress Bar */}
             <div className="w-full bg-zinc-800 rounded-full h-4 mb-2 overflow-hidden border border-zinc-700">
               <div 
                 className="bg-[#F5B301] h-4 rounded-full transition-all duration-300 relative"
                 style={{ width: `${progress}%` }}
               >
                  <div className="absolute top-0 left-0 bottom-0 right-0 overflow-hidden">
                    <div className="w-full h-full bg-white/20 animate-[shimmer_1s_infinite_linear] skew-x-12 transform -translate-x-full"></div>
                  </div>
               </div>
             </div>
             <p className="text-zinc-300 font-bold text-lg">{progress}%</p>
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
                 onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); setProgress(0); }}
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
