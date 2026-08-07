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
  const progressInterval = useRef(null);
  
  // Settings States
  const [formatPreset, setFormatPreset] = useState('16:9');
  const [hdOutput, setHdOutput] = useState(false);
  const [zoomRate, setZoomRate] = useState(0.04);
  const [zoomDirection, setZoomDirection] = useState('in');
  const [panStyle, setPanStyle] = useState('center');
  
  const validTypes = ['ken-burns', 'vhs-tape'];
  
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  // Handle simulated progress bar
  useEffect(() => {
    if (status === 'processing') {
      setProgress(1);
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          // Slow down as it approaches 85%
          if (prev >= 85) return 85;
          const increment = (85 - prev) * 0.05 + 0.1;
          return Math.min(85, prev + increment);
        });
      }, 500);
    } else if (status === 'completed') {
      setProgress(100);
      if (progressInterval.current) clearInterval(progressInterval.current);
    } else if (status === 'error' || status === 'idle' || status === 'uploading') {
      setProgress(0);
      if (progressInterval.current) clearInterval(progressInterval.current);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [status]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (type === 'ken-burns' && !selectedFile.type.startsWith('image/')) {
        setErrorMsg('Ken Burns efekti için sadece resim dosyası seçebilirsiniz.');
        return;
      }
      setFile(selectedFile);
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
      
      const apiUrl = import.meta.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
      
      const uploadRes = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Upload failed on server (Code: ${uploadRes.status}).`);
      }
      
      const uploadData = await uploadRes.json();
      const jobId = uploadData.job_id;
      
      setStatus('processing');
      const jobRef = doc(db, 'render_jobs', jobId);
      
      const params = {
        format_preset: formatPreset,
        hd_output: hdOutput
      };
      
      if (type === 'ken-burns') {
        params.zoom_rate = parseFloat(zoomRate);
        params.zoom_direction = zoomDirection;
        params.pan_style = panStyle;
      }

      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        tool_type: type,
        status: 'pending',
        created_at: serverTimestamp(),
        params: params
      });
      
      // Ping the worker explicitly to ensure it checks the queue
      fetch(`${apiUrl}/jobs/ping`).catch(e => console.error('Ping failed:', e));
      
      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'completed') {
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
    <div className="w-full flex-grow flex flex-col h-full">
      <div className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full relative z-10 text-white h-full min-h-0">
        <header className="mb-6 flex-shrink-0 flex flex-col items-start">
          <h1 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">
            {effectTitle} <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">Effect</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
            Upload {type === 'ken-burns' ? 'an image' : 'a video or image'} (max 50MB) to apply the {effectTitle} effect.
          </p>
        </header>
        
        <main className="flex-1 flex flex-col min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1 min-h-0">
            
            {/* Left Column: Uploader & Progress */}
            <div className="lg:col-span-7 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center h-auto lg:h-full lg:overflow-y-auto overflow-x-hidden custom-scrollbar shadow-2xl relative min-h-[400px]">
          
          {/* Glass Gradient Decor */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#F5B301]/20 blur-3xl rounded-full pointer-events-none"></div>
          
          {status === 'idle' || status === 'error' ? (
            <div className="flex flex-col items-center w-full relative z-10">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-56 border-2 border-dashed border-zinc-700/80 hover:border-[#F5B301]/50 bg-zinc-800/30 hover:bg-zinc-800/60 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center rounded-2xl cursor-pointer mb-6 group"
              >
                 <svg className="w-12 h-12 text-zinc-500 group-hover:text-[#F5B301] group-hover:scale-110 transition-all duration-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                 </svg>
                 <span className="text-zinc-300 font-medium">Click to select {type === 'ken-burns' ? 'an image' : 'a video/image'}</span>
                 <span className="text-zinc-500 text-sm mt-2 font-mono">Max 50MB</span>
              </div>
              
              <input 
                type="file" 
                accept={type === 'ken-burns' ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,image/jpeg,image/png"} 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              
              {file && (
                 <div className="w-full bg-zinc-800/80 backdrop-blur-md border border-zinc-700/80 p-4 rounded-xl flex items-center justify-between mb-6 shadow-lg">
                   <div className="truncate text-zinc-200 font-medium mr-4">{file.name}</div>
                   <div className="text-zinc-500 text-sm font-mono whitespace-nowrap">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                 </div>
              )}
              
              {file && (
                 <button 
                   onClick={startProcessing}
                   className="w-full py-4 bg-gradient-to-r from-[#F5B301] to-[#FF9D00] hover:from-yellow-400 hover:to-yellow-500 rounded-xl shadow-[0_0_30px_rgba(245,179,1,0.25)] hover:shadow-[0_0_40px_rgba(245,179,1,0.4)] font-bold text-black text-lg transition-all duration-300 scale-100 active:scale-95"
                 >
                   Start Processing
                 </button>
              )}
              
              {status === 'error' && (
                <div className="mt-6 w-full bg-red-900/20 backdrop-blur-sm border border-red-500/30 p-4 rounded-xl text-red-400 text-sm font-medium shadow-lg">
                  {errorMsg}
                </div>
              )}
            </div>
            
          ) : status === 'uploading' || status === 'processing' ? (
            <div className="flex flex-col items-center w-full max-w-md relative z-10">
              <h2 className="text-2xl font-bold mb-8">
                {status === 'uploading' ? 'Uploading...' : 'Applying Effect...'}
              </h2>
              
              {/* Simulated Progress Bar */}
              <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden mb-4 relative shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#F5B301] via-yellow-400 to-orange-500 transition-all duration-500 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              
              <div className="flex justify-between w-full text-sm font-mono text-zinc-400 mb-8">
                <span>{Math.round(progress)}%</span>
                <span>{status === 'processing' ? 'Processing on Render' : 'Sending file'}</span>
              </div>
            </div>
            
          ) : status === 'completed' ? (
            <div className="flex flex-col items-center w-full relative z-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-6">Success!</h2>
              
              <div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden border border-zinc-700/80 shadow-2xl mb-8 group">
                 <video src={resultUrl} controls autoPlay loop className="w-full h-auto" />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                 <a 
                   href={resultUrl} 
                   download 
                   target="_blank" rel="noreferrer"
                   className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold rounded-xl transition-all duration-300 text-center shadow-lg"
                 >
                   Download Video
                 </a>
                 <button 
                   onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); setProgress(0); }}
                   className="flex-1 py-3 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md font-bold rounded-xl border border-zinc-700 transition-all duration-300 text-center"
                 >
                   Create Another
                 </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-5 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col h-auto lg:h-full lg:overflow-y-auto overflow-x-hidden custom-scrollbar shadow-2xl min-h-[400px]">
            <h3 className="text-xl font-bold mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Effect Settings
            </h3>
            
            {/* Common Settings */}
            <div className="space-y-6">
              
              {/* Output Format */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Video Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {['16:9', '9:16', '1:1'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormatPreset(fmt)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        formatPreset === fmt 
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' 
                          : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:bg-zinc-800'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ken Burns Specific Settings */}
              {type === 'ken-burns' && (
                <>
                  <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Zoom Direction</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['in', 'out'].map((dir) => (
                          <button
                            key={dir}
                            onClick={() => setZoomDirection(dir)}
                            className={`py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                              zoomDirection === dir 
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' 
                                : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:bg-zinc-800'
                            }`}
                          >
                            Zoom {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Camera Pan</label>
                      <select 
                        value={panStyle}
                        onChange={(e) => setPanStyle(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm text-zinc-200 outline-none focus:border-blue-500/50 transition-all appearance-none"
                      >
                        <option value="center">Center (No Pan)</option>
                        <option value="left_to_right">Left to Right</option>
                        <option value="right_to_left">Right to Left</option>
                        <option value="top_to_bottom">Top to Bottom</option>
                        <option value="bottom_to_top">Bottom to Top</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2 flex justify-between">
                        <span>Zoom Speed</span>
                        <span className="text-blue-400">{zoomRate}</span>
                      </label>
                      <input 
                        type="range" 
                        min="0.01" max="0.10" step="0.01" 
                        value={zoomRate}
                        onChange={(e) => setZoomRate(e.target.value)}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Pro Toggle */}
              <div className="pt-4 border-t border-zinc-800/80">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors flex items-center">
                      1080p HD Output
                      <span className="ml-2 text-xs py-0.5 px-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white font-bold">PRO</span>
                    </span>
                    {hdOutput && <span className="text-xs text-amber-500/80 mt-1">⚠️ 1080p processing takes longer</span>}
                  </div>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={hdOutput} 
                      onChange={() => setHdOutput(!hdOutput)} 
                    />
                    <div className={`block w-12 h-7 rounded-full transition-colors duration-300 ${hdOutput ? 'bg-[#F5B301]' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${hdOutput ? 'translate-x-5' : ''}`}></div>
                  </div>
                </label>
              </div>

            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
