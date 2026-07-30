import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export default function VideoEffectTool() {
  const { type } = useParams();
  const lang = useSettingsStore(state => state.lang);
  const isPro = useAuthStore(state => state.user?.isPro);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);
  
  // Ken Burns settings
  const [zoomDirection, setZoomDirection] = useState('in');
  const [panStyle, setPanStyle] = useState('center');
  
  // Shared settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [hdOutput, setHdOutput] = useState(false);
  
  // Desteklenen tipler
  const validTypes = ['ken-burns', 'vhs-tape'];
  
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  // --- Simüle Progress Bar ---
  const startSimulatedProgress = useCallback(() => {
    setProgress(1);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    let current = 1;
    progressTimerRef.current = setInterval(() => {
      // Yavaşça %85'e kadar dolsun, asla geçmesin
      if (current < 85) {
        // Yavaşlayan artış: başta hızlı, sona doğru çok yavaş
        const increment = Math.max(0.1, (85 - current) * 0.015);
        current = Math.min(85, current + increment);
        setProgress(current);
      }
    }, 500);
  }, []);

  const stopSimulatedProgress = useCallback((final) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(final);
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

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
      
      // 2. Firestore'da job_id ile bir görev oluştur (params ile birlikte)
      setStatus('processing');
      setProgress(1); // pending = %1'de sabit
      
      const params = {};
      
      // Ken Burns özel parametreleri
      if (type === 'ken-burns') {
        params.zoom_direction = zoomDirection;
        params.pan_style = panStyle;
      }
      
      // Ortak parametreler
      params.aspect_ratio = aspectRatio;
      if (hdOutput && isPro) {
        params.hd_output = true;
      }
      
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
          
          if (data.status === 'processing') {
            // processing → simüle progress başlat
            startSimulatedProgress();
          } else if (data.status === 'completed') {
            // completed → anında %100'e zıpla
            stopSimulatedProgress(100);
            setResultUrl(`${apiUrl}${data.result_url}`);
            setStatus('completed');
            unsubscribe();
          } else if (data.status === 'failed') {
            // failed → kırmızıya dön
            stopSimulatedProgress(0);
            setErrorMsg(data.error_message || 'Processing failed.');
            setStatus('error');
            unsubscribe();
          }
          // pending → %1'de sabit kal (zaten set edildi)
        }
      });
      
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Bir hata oluştu.');
      setStatus('error');
      stopSimulatedProgress(0);
    }
  };

  const effectTitle = type ? type.replace('-', ' ').toUpperCase() : '';
  const isKenBurns = type === 'ken-burns';

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 relative z-10 min-h-[calc(100dvh-80px)] text-white">
      <h1 className="text-3xl md:text-4xl font-black mb-2 uppercase bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
        {effectTitle} Effect
      </h1>
      <p className="text-zinc-400 mb-6 md:mb-8 text-sm md:text-base">
        Upload a video or image (max 50MB) to apply the {effectTitle} effect.
      </p>
      
      {/* --- MAIN CARD --- */}
      <div className="relative rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, rgba(24,24,27,0.9), rgba(9,9,11,0.95))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}>
        {/* Glassmorphism glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-20 pointer-events-none" 
          style={{ background: type === 'ken-burns' ? 'radial-gradient(circle, #F5B301, transparent)' : 'radial-gradient(circle, #3B82F6, transparent)' }} />
        
        <div className="p-6 md:p-8">
          {status === 'idle' || status === 'error' ? (
            <div className="flex flex-col items-center w-full">
              
              {/* --- SETTINGS PANEL --- */}
              <div className="w-full mb-6 space-y-4">
                
                {/* Video Format */}
                <div className="rounded-xl p-4" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3 block">
                    Video Format
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: '16:9', label: '16:9', desc: 'Landscape' },
                      { value: '9:16', label: '9:16', desc: 'Portrait' },
                      { value: '1:1', label: '1:1', desc: 'Square' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAspectRatio(opt.value)}
                        className="flex-1 min-w-[80px] py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200"
                        style={{
                          background: aspectRatio === opt.value
                            ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))'
                            : 'rgba(255,255,255,0.04)',
                          border: aspectRatio === opt.value
                            ? '1px solid rgba(59,130,246,0.5)'
                            : '1px solid rgba(255,255,255,0.06)',
                          color: aspectRatio === opt.value ? '#93C5FD' : '#A1A1AA'
                        }}
                      >
                        <div>{opt.label}</div>
                        <div className="text-[10px] opacity-60 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ken Burns Settings */}
                {isKenBurns && (
                  <>
                    {/* Zoom Direction */}
                    <div className="rounded-xl p-4" style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3 block">
                        Zoom Direction
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'in', label: '🔍 Zoom In', desc: 'Yakınlaş' },
                          { value: 'out', label: '🔭 Zoom Out', desc: 'Uzaklaş' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setZoomDirection(opt.value)}
                            className="flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200"
                            style={{
                              background: zoomDirection === opt.value
                                ? 'linear-gradient(135deg, rgba(245,179,1,0.25), rgba(234,88,12,0.25))'
                                : 'rgba(255,255,255,0.04)',
                              border: zoomDirection === opt.value
                                ? '1px solid rgba(245,179,1,0.5)'
                                : '1px solid rgba(255,255,255,0.06)',
                              color: zoomDirection === opt.value ? '#FCD34D' : '#A1A1AA'
                            }}
                          >
                            <div>{opt.label}</div>
                            <div className="text-[10px] opacity-60 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pan Style */}
                    <div className="rounded-xl p-4" style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3 block">
                        Camera Pan
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { value: 'center', label: '⊙', desc: 'Center' },
                          { value: 'left_to_right', label: '→', desc: 'L→R' },
                          { value: 'right_to_left', label: '←', desc: 'R→L' },
                          { value: 'bottom_to_top', label: '↑', desc: 'B→T' },
                          { value: 'top_to_bottom', label: '↓', desc: 'T→B' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setPanStyle(opt.value)}
                            className="flex-1 min-w-[56px] py-3 px-2 rounded-lg font-semibold text-sm transition-all duration-200"
                            style={{
                              background: panStyle === opt.value
                                ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))'
                                : 'rgba(255,255,255,0.04)',
                              border: panStyle === opt.value
                                ? '1px solid rgba(16,185,129,0.5)'
                                : '1px solid rgba(255,255,255,0.06)',
                              color: panStyle === opt.value ? '#6EE7B7' : '#A1A1AA'
                            }}
                          >
                            <div className="text-lg">{opt.label}</div>
                            <div className="text-[10px] opacity-60 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 1080p HD Toggle (Pro Only) */}
                <div className="rounded-xl p-4 flex items-center justify-between" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div>
                    <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                      1080p HD Output
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{
                        background: 'linear-gradient(135deg, #F5B301, #EA580C)',
                        color: '#000'
                      }}>PRO</span>
                    </div>
                    {hdOutput && isPro && (
                      <div className="text-[11px] text-amber-400/70 mt-1">⚠️ 1080p output takes longer to process</div>
                    )}
                    {hdOutput && !isPro && (
                      <div className="text-[11px] text-red-400/70 mt-1">Pro subscription required</div>
                    )}
                  </div>
                  <button
                    onClick={() => setHdOutput(!hdOutput)}
                    className="relative w-12 h-6 rounded-full transition-all duration-300"
                    style={{
                      background: hdOutput && isPro
                        ? 'linear-gradient(135deg, #F5B301, #EA580C)'
                        : 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300"
                      style={{ left: hdOutput && isPro ? '26px' : '2px' }}
                    />
                  </button>
                </div>
              </div>
              
              {/* --- DROP ZONE --- */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 md:h-48 rounded-xl cursor-pointer mb-4 flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.01]"
                style={{
                  border: '2px dashed rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.02)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                  e.currentTarget.style.background = 'rgba(59,130,246,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                 <svg className="w-10 h-10 md:w-12 md:h-12 text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                 </svg>
                 <span className="text-zinc-400 font-medium text-sm md:text-base">Click to select a video/image</span>
                 <span className="text-zinc-600 text-xs mt-1">Max 50MB • MP4, MOV, JPG, PNG</span>
              </div>
              
              <input 
                type="file" 
                accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              
              {file && (
                <div className="w-full rounded-lg flex items-center justify-between mb-4 p-3" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div className="truncate text-zinc-300 font-medium text-sm">{file.name}</div>
                  <div className="text-zinc-500 text-xs ml-2 shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
              )}
              
              {file && (
                <button 
                  onClick={startProcessing}
                  className="w-full py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] min-h-[48px]"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                    boxShadow: '0 0 30px rgba(59,130,246,0.25), 0 4px 15px rgba(0,0,0,0.3)'
                  }}
                >
                  ✨ Start Processing
                </button>
              )}
              
              {status === 'error' && (
                <div className="mt-4 w-full rounded-lg p-4 text-sm font-medium" style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#FCA5A5'
                }}>
                  {errorMsg}
                </div>
              )}
            </div>
            
          ) : status === 'uploading' ? (
            <div className="flex flex-col items-center py-8 md:py-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-blue-400 font-bold text-lg md:text-xl">Uploading...</p>
              <p className="text-zinc-500 text-xs md:text-sm mt-2">Sending your file to the server</p>
            </div>
            
          ) : status === 'processing' ? (
            <div className="flex flex-col items-center py-8 md:py-12 w-full">
              {/* Progress Bar */}
              <div className="w-full max-w-md mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Processing</span>
                  <span className="text-xs font-bold" style={{
                    color: '#F5B301'
                  }}>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden" style={{
                  background: 'rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
                }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #F5B301, #EA580C, #EF4444)',
                      boxShadow: '0 0 15px rgba(245,179,1,0.4)',
                    }}
                  />
                </div>
              </div>
              
              <div className="w-14 h-14 border-3 border-t-transparent rounded-full animate-spin mb-5" style={{
                borderColor: 'rgba(245,179,1,0.3)',
                borderTopColor: 'transparent',
                borderRightColor: '#F5B301'
              }}></div>
              <p className="font-bold text-lg" style={{ color: '#F5B301' }}>Applying {effectTitle}...</p>
              <p className="text-zinc-500 text-xs mt-2">This may take a minute. Don't close this tab.</p>
            </div>
            
          ) : status === 'completed' ? (
            <div className="flex flex-col items-center w-full py-4">
              {/* Success checkmark */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))',
                border: '2px solid rgba(16,185,129,0.4)'
              }}>
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-6">Effect Applied!</h2>
              
              <div className="relative w-full max-w-2xl rounded-xl overflow-hidden mb-6" style={{
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 40px rgba(0,0,0,0.4)'
              }}>
                 <video src={resultUrl} controls autoPlay loop className="w-full h-auto max-h-[500px]" />
              </div>
              
              <div className="flex gap-3 flex-wrap justify-center">
                 <a 
                   href={resultUrl} 
                   download 
                   target="_blank" rel="noreferrer"
                   className="px-6 py-3 font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm md:text-base min-h-[48px] flex items-center"
                   style={{
                     background: 'linear-gradient(135deg, #10B981, #06B6D4)',
                     boxShadow: '0 0 20px rgba(16,185,129,0.25)'
                   }}
                 >
                   ⬇ Download Video
                 </a>
                 <button 
                   onClick={() => { setStatus('idle'); setFile(null); setResultUrl(''); setProgress(0); }}
                   className="px-6 py-3 font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm md:text-base min-h-[48px]"
                   style={{
                     background: 'rgba(255,255,255,0.06)',
                     border: '1px solid rgba(255,255,255,0.1)'
                   }}
                 >
                   + Create Another
                 </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
