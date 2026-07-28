import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useSettingsStore } from '../store/settingsStore';

/* ─── Simulated Progress Bar Hook ─── */
function useSimulatedProgress(status) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Temizle
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    if (status === 'idle' || status === 'error') {
      setProgress(0);
      return;
    }
    
    if (status === 'uploading') {
      setProgress(1);
      return;
    }
    
    if (status === 'processing') {
      // %1'de sabit başla, sonra yavaşça %85'e kadar dol
      setProgress(1);
      let current = 1;
      intervalRef.current = setInterval(() => {
        current += Math.random() * 1.5 + 0.3; // ~0.3-1.8% arası rastgele artış
        if (current >= 85) current = 85;
        setProgress(Math.round(current));
      }, 2000); // Her 2 saniyede bir artır
      return;
    }
    
    if (status === 'completed') {
      setProgress(100);
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status]);

  return progress;
}

/* ─── Settings Panel Components ─── */
function SettingSelect({ label, value, onChange, options, icon }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-2.5 text-sm text-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60
                   transition-all duration-200 appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange, warning }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 
            ${checked ? 'bg-blue-600' : 'bg-zinc-700'}`}
          style={{ minWidth: '2.75rem', minHeight: '1.5rem' }}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
            ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {checked && warning && (
        <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1">
          <span>⚠️</span> {warning}
        </p>
      )}
    </div>
  );
}

/* ─── Glassmorphism Progress Bar ─── */
function ProgressBar({ progress, status }) {
  const getBarColor = () => {
    if (status === 'error') return 'bg-red-500';
    if (status === 'completed') return 'bg-green-500';
    return 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500';
  };

  const getStatusText = () => {
    if (status === 'uploading') return 'Yükleniyor...';
    if (status === 'processing') return `İşleniyor... %${progress}`;
    if (status === 'completed') return 'Tamamlandı!';
    if (status === 'error') return 'Hata oluştu';
    return '';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-zinc-300">{getStatusText()}</span>
        <span className="text-sm font-bold text-zinc-400">{progress}%</span>
      </div>
      <div className="w-full h-3 rounded-full bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${getBarColor()} shadow-lg`}
          style={{
            width: `${progress}%`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: status === 'processing' ? '0 0 20px rgba(139, 92, 246, 0.4)' : 
                        status === 'completed' ? '0 0 20px rgba(34, 197, 94, 0.4)' : 'none',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function VideoEffectTool() {
  const { type } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const fileInputRef = useRef(null);
  
  // Effect settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [hdOutput, setHdOutput] = useState(false);
  const [zoomDirection, setZoomDirection] = useState('in');
  const [panStyle, setPanStyle] = useState('center');
  
  const progress = useSimulatedProgress(status);
  
  const validTypes = ['ken-burns', 'vhs-tape'];
  const isKenBurns = type === 'ken-burns';
  
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
      
      // Firestore'da job oluştur — params ile birlikte
      setStatus('processing');
      const jobRef = doc(db, 'render_jobs', jobId);
      
      const params = {
        aspect_ratio: aspectRatio,
        hd_output: hdOutput,
      };
      
      // Ken Burns'e özel parametreler
      if (isKenBurns) {
        params.zoom_direction = zoomDirection;
        params.pan_style = panStyle;
      }
      
      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        tool_type: type,
        status: 'pending',
        created_at: serverTimestamp(),
        params
      });
      
      // Durumu Firestore üzerinden dinle
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
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 relative z-10 text-white"
         style={{ minHeight: 'calc(100dvh - 80px)' }}>
      <h1 className="text-3xl sm:text-4xl font-black mb-2 uppercase">{effectTitle} Effect</h1>
      <p className="text-zinc-400 mb-6 sm:mb-8 text-sm sm:text-base">
        Upload a video or image (max 50MB) to apply the {effectTitle} effect.
      </p>
      
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center"
           style={{ minHeight: '400px' }}>
        
        {status === 'idle' || status === 'error' ? (
          <div className="flex flex-col items-center w-full max-w-lg">
            
            {/* Sürükle Bırak / Tıkla Alanı */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 sm:h-48 border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-200 flex flex-col items-center justify-center rounded-xl cursor-pointer mb-4 sm:mb-6"
              style={{ minHeight: '44px' }}
            >
               <svg className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-500 mb-3 sm:mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
               <span className="text-zinc-400 font-medium text-sm sm:text-base">Click to select a video/image</span>
               <span className="text-zinc-500 text-xs sm:text-sm mt-1">Max 50MB</span>
            </div>
            
            <input 
              type="file" 
              accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            
            {file && (
               <div className="w-full bg-zinc-800/70 border border-zinc-700/60 p-3 sm:p-4 rounded-lg flex items-center justify-between mb-4 sm:mb-6">
                 <div className="truncate text-zinc-300 font-medium text-sm sm:text-base">{file.name}</div>
                 <div className="text-zinc-500 text-xs sm:text-sm ml-2 flex-shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
               </div>
            )}

            {/* ─── Settings Panel ─── */}
            {file && (
              <div className="w-full bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4 sm:p-5 mb-4 sm:mb-6 space-y-4
                            transition-all duration-300 ease-out">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>⚙️</span> Settings
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Format Preset */}
                  <SettingSelect
                    label="Video Format"
                    icon="📐"
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    options={[
                      { value: '16:9', label: '16:9 — Yatay (YouTube)' },
                      { value: '9:16', label: '9:16 — Dikey (TikTok/Reels)' },
                      { value: '1:1',  label: '1:1 — Kare (Instagram)' },
                    ]}
                  />
                  
                  {/* Ken Burns: Zoom Direction */}
                  {isKenBurns && (
                    <SettingSelect
                      label="Zoom Direction"
                      icon="🔍"
                      value={zoomDirection}
                      onChange={setZoomDirection}
                      options={[
                        { value: 'in',  label: 'İçeri Doğru (Zoom In)' },
                        { value: 'out', label: 'Dışarı Doğru (Zoom Out)' },
                      ]}
                    />
                  )}
                  
                  {/* Ken Burns: Pan Style */}
                  {isKenBurns && (
                    <SettingSelect
                      label="Camera Movement"
                      icon="🎬"
                      value={panStyle}
                      onChange={setPanStyle}
                      options={[
                        { value: 'center',          label: 'Merkezde Kal' },
                        { value: 'left_to_right',   label: 'Soldan Sağa' },
                        { value: 'right_to_left',   label: 'Sağdan Sola' },
                        { value: 'top_to_bottom',   label: 'Yukarıdan Aşağı' },
                        { value: 'bottom_to_top',   label: 'Aşağıdan Yukarı' },
                      ]}
                    />
                  )}
                </div>

                {/* 1080p Pro Toggle */}
                <div className="pt-3 border-t border-zinc-700/40">
                  <ToggleSwitch
                    label="1080p HD Çıktı (Pro)"
                    checked={hdOutput}
                    onChange={setHdOutput}
                    warning="1080p çıktı daha yavaş sürer"
                  />
                </div>
              </div>
            )}
            
            {file && (
               <button 
                 onClick={startProcessing}
                 className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] font-bold text-base sm:text-lg transition-all duration-200"
                 style={{ minHeight: '44px' }}
               >
                 Start Processing
               </button>
            )}
            
            {status === 'error' && (
              <div className="mt-4 sm:mt-6 w-full bg-red-900/30 border border-red-500/50 p-3 sm:p-4 rounded-lg text-red-400 text-xs sm:text-sm font-medium">
                {errorMsg}
              </div>
            )}
          </div>
          
        ) : status === 'uploading' || status === 'processing' ? (
          <div className="flex flex-col items-center w-full max-w-md px-2">
             <div className={`w-14 h-14 sm:w-16 sm:h-16 border-4 rounded-full animate-spin mb-6
               ${status === 'uploading' ? 'border-blue-500 border-t-transparent' : 'border-purple-500 border-t-transparent'}`} />
             <p className={`font-bold text-lg sm:text-xl mb-1
               ${status === 'uploading' ? 'text-blue-400' : 'text-purple-400'}`}>
               {status === 'uploading' ? 'Uploading...' : 'Applying Effect...'}
             </p>
             <p className="text-zinc-500 text-xs sm:text-sm mb-6 text-center">
               {status === 'uploading' 
                 ? 'Sending your file to the backend' 
                 : 'Running isolated job runner on Render. Please wait.'}
             </p>
             <ProgressBar progress={progress} status={status} />
          </div>
          
        ) : status === 'completed' ? (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-green-400 mb-4 sm:mb-6">Effect Applied Successfully!</h2>
            
            <div className="w-full mb-4">
              <ProgressBar progress={100} status="completed" />
            </div>
            
            <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden border border-zinc-700 mb-4 sm:mb-6">
               <video src={resultUrl} controls autoPlay loop playsInline className="w-full h-auto max-h-[500px]" />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
               <a 
                 href={resultUrl} 
                 download 
                 target="_blank" rel="noreferrer"
                 className="px-6 sm:px-8 py-3 bg-green-600 hover:bg-green-500 font-bold rounded-lg transition-all duration-200 text-center"
                 style={{ minHeight: '44px' }}
               >
                 Download Video
               </a>
               <button 
                 onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); }}
                 className="px-6 sm:px-8 py-3 bg-zinc-800 hover:bg-zinc-700 font-bold rounded-lg border border-zinc-700 transition-all duration-200"
                 style={{ minHeight: '44px' }}
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
