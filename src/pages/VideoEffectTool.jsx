import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Helmet } from 'react-helmet-async';
import { createVideoFromFrames } from '../lib/ffmpeg';
import {
  drawGlitchEffect,
  drawTypewriterFrame,
  drawScanlineEffect,
  drawAsciiEffect,
  drawVignette
} from '../renderer/effects';

export default function VideoEffectTool() {
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draft');
  const lang = useSettingsStore(state => state.lang);
  const { user, saveProject } = useAuthStore();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Common Settings
  const [formatPreset, setFormatPreset] = useState('16:9'); // '16:9' | '9:16' | '1:1'
  const [hdOutput, setHdOutput] = useState(false);
  const [renderEngine, setRenderEngine] = useState('device'); // 'device' | 'cloud'

  // Tool Specific Settings
  // Ken Burns
  const [zoomRate, setZoomRate] = useState(0.04);
  const [zoomDirection, setZoomDirection] = useState('in');
  const [panStyle, setPanStyle] = useState('center');

  // Glitch Master
  const [glitchIntensity, setGlitchIntensity] = useState(0.6);
  const [rgbShift, setRgbShift] = useState(14);
  const [sliceRate, setSliceRate] = useState(8);

  // Typewriter
  const [typewriterText, setTypewriterText] = useState(
    lang === 'tr'
      ? "Her hikaye tek bir kelimeyle başlar.\nAnimationMaker büyüleyici videolar üretir."
      : "Every story begins with a single word.\nAnimationMaker creates the magic."
  );
  const [typingSpeed, setTypingSpeed] = useState(18); // chars per sec
  const [cursorStyle, setCursorStyle] = useState('block'); // 'block' | 'line' | 'underscore'
  const [fontColor, setFontColor] = useState('#FFFFFF');

  // Scanline CRT
  const [scanlineDensity, setScanlineDensity] = useState(4);
  const [phosphorGlow, setPhosphorGlow] = useState(0.5);

  // ASCII Matrix
  const [asciiTheme, setAsciiTheme] = useState('matrixGreen'); // 'matrixGreen' | 'cyberNeon' | 'retroAmber' | 'trueColor'
  const [asciiResolution, setAsciiResolution] = useState(12);

  // Echo Motion
  const [echoCount, setEchoCount] = useState(5);
  const [echoDecay, setEchoDecay] = useState(0.7);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const sourceMediaRef = useRef(null);

  const validTypes = ['ken-burns', 'vhs-tape', 'glitch-master', 'typewriter', 'scanline', 'ascii', 'echo'];

  // Validate route
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  // Restore Draft if provided
  useEffect(() => {
    if (draftId) {
      try {
        const savedDraft = localStorage.getItem('draft_project');
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.projectName) setProjectName(parsed.projectName);
          if (parsed.formatPreset) setFormatPreset(parsed.formatPreset);
          if (parsed.glitchIntensity !== undefined) setGlitchIntensity(parsed.glitchIntensity);
          if (parsed.rgbShift !== undefined) setRgbShift(parsed.rgbShift);
          if (parsed.typewriterText) setTypewriterText(parsed.typewriterText);
          if (parsed.typingSpeed) setTypingSpeed(parsed.typingSpeed);
          if (parsed.scanlineDensity) setScanlineDensity(parsed.scanlineDensity);
          if (parsed.asciiTheme) setAsciiTheme(parsed.asciiTheme);
          if (parsed.echoCount) setEchoCount(parsed.echoCount);
        }
      } catch (err) {
        console.error("Draft restore error:", err);
      }
    }
  }, [draftId]);

  // Default Project Name
  useEffect(() => {
    if (!projectName) {
      const defaultTitles = {
        'glitch-master': 'Cyber Glitch Project',
        'typewriter': 'Typewriter Story',
        'scanline': 'Retro CRT Tape',
        'ascii': 'Matrix Code Art',
        'echo': 'Motion Echo Clip',
        'ken-burns': 'Cinematic Photo Story',
        'vhs-tape': '90s VHS Tape'
      };
      setProjectName(defaultTitles[type] || `${type} Project`);
    }
  }, [type, projectName]);

  // Auto-Save Project to Firestore Cloud & localStorage
  const handleSaveProject = useCallback(async () => {
    if (!user) return;
    try {
      setIsSaving(true);
      const currentSettings = {
        projectName,
        formatPreset,
        hdOutput,
        glitchIntensity,
        rgbShift,
        sliceRate,
        typewriterText,
        typingSpeed,
        cursorStyle,
        fontColor,
        scanlineDensity,
        phosphorGlow,
        asciiTheme,
        asciiResolution,
        echoCount,
        echoDecay,
        zoomRate,
        zoomDirection,
        panStyle
      };
      localStorage.setItem('draft_project', JSON.stringify({ id: draftId || 'draft', ...currentSettings }));
      await saveProject(type, currentSettings, draftId);
    } catch (e) {
      console.error("Auto save failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, [
    user, type, draftId, projectName, formatPreset, hdOutput,
    glitchIntensity, rgbShift, sliceRate, typewriterText, typingSpeed,
    cursorStyle, fontColor, scanlineDensity, phosphorGlow,
    asciiTheme, asciiResolution, echoCount, echoDecay, zoomRate, zoomDirection, panStyle, saveProject
  ]);

  // Handle File Input
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setStatus('idle');
      setErrorMsg('');
      setResultUrl('');

      if (selectedFile.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          sourceMediaRef.current = img;
        };
      } else if (selectedFile.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.src = url;
        vid.crossOrigin = 'anonymous';
        vid.loop = true;
        vid.muted = true;
        vid.play().catch(() => {});
        sourceMediaRef.current = vid;
      }
    }
  };

  // Generate Sample Texture if no file uploaded
  useEffect(() => {
    if (!fileUrl && type !== 'typewriter') {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 640;
      sampleCanvas.height = 360;
      const sCtx = sampleCanvas.getContext('2d');
      
      const grad = sCtx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#1a103c');
      grad.addColorStop(0.5, '#0d2b45');
      grad.addColorStop(1, '#203c56');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 640, 360);

      sCtx.fillStyle = '#FFFFFF';
      sCtx.font = '900 36px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('ANIMATIONMAKER', 320, 160);
      sCtx.fillStyle = '#F5B301';
      sCtx.font = 'bold 20px monospace';
      sCtx.fillText(`[ ${type.toUpperCase()} PREVIEW ]`, 320, 205);
      
      sourceMediaRef.current = sampleCanvas;
    }
  }, [fileUrl, type]);

  // Live Canvas Interactive Preview Loop
  useEffect(() => {
    let active = true;
    let startTime = performance.now();

    const renderLoop = (time) => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const elapsed = (time - startTime) / 1000;
        const progress = (elapsed % 3) / 3;

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, width, height, progress, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            darkTheme: true
          });
        } else if (type === 'glitch-master') {
          drawGlitchEffect(ctx, sourceMediaRef.current, width, height, progress, {
            intensity: glitchIntensity,
            rgbShift,
            sliceRate
          });
        } else if (type === 'scanline') {
          drawScanlineEffect(ctx, sourceMediaRef.current, width, height, progress, {
            density: scanlineDensity,
            glow: phosphorGlow
          });
        } else if (type === 'ascii') {
          drawAsciiEffect(ctx, sourceMediaRef.current, width, height, progress, {
            theme: asciiTheme,
            resolution: asciiResolution
          });
        } else if (type === 'ken-burns' || type === 'vhs-tape' || type === 'echo') {
          ctx.fillStyle = '#0a0a0c';
          ctx.fillRect(0, 0, width, height);
          if (sourceMediaRef.current) {
            ctx.save();
            const scale = 1 + (progress * 0.15);
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(sourceMediaRef.current, -width / 2, -height / 2, width, height);
            ctx.restore();
            drawVignette(ctx, width, height, 0.4);
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    type, typewriterText, fontColor, cursorStyle,
    glitchIntensity, rgbShift, sliceRate,
    scanlineDensity, phosphorGlow, asciiTheme, asciiResolution
  ]);

  // 1. Client-Side Device Render (FFmpeg WASM & Canvas Frames)
  const startDeviceRender = async () => {
    try {
      setStatus('processing');
      setProgress(5);
      setErrorMsg('');

      const canvas = document.createElement('canvas');
      const [wRatio, hRatio] = formatPreset.split(':').map(Number);
      const baseWidth = hdOutput ? 1080 : 720;
      canvas.width = baseWidth;
      canvas.height = Math.round((baseWidth / wRatio) * hRatio);
      if (canvas.height % 2 !== 0) canvas.height += 1;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const fps = 30;
      const durationSec = type === 'typewriter' ? Math.max(3, Math.ceil(typewriterText.length / typingSpeed) + 1) : 3.5;
      const totalFrames = Math.round(fps * durationSec);
      const frames = [];

      for (let i = 0; i < totalFrames; i++) {
        const frameProgress = i / totalFrames;

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, canvas.width, canvas.height, frameProgress, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            darkTheme: true
          });
        } else if (type === 'glitch-master') {
          drawGlitchEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            intensity: glitchIntensity,
            rgbShift,
            sliceRate
          });
        } else if (type === 'scanline') {
          drawScanlineEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            density: scanlineDensity,
            glow: phosphorGlow
          });
        } else if (type === 'ascii') {
          drawAsciiEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            theme: asciiTheme,
            resolution: asciiResolution
          });
        } else {
          ctx.fillStyle = '#0a0a0c';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (sourceMediaRef.current) {
            ctx.drawImage(sourceMediaRef.current, 0, 0, canvas.width, canvas.height);
          }
        }

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        const arrayBuf = await blob.arrayBuffer();
        frames.push(new Uint8Array(arrayBuf));

        if (i % 10 === 0) {
          setProgress(Math.round((i / totalFrames) * 45));
        }
      }

      setProgress(50);
      const videoUrl = await createVideoFromFrames(frames, null, fps, hdOutput, (p) => {
        setProgress(Math.round(p));
      });

      setResultUrl(videoUrl);
      setStatus('completed');
      handleSaveProject();
    } catch (err) {
      console.error("Device render error:", err);
      setErrorMsg(err.message || 'Render failed on device.');
      setStatus('error');
    }
  };

  // 2. Cloud Processing Fallback (Firebase render_jobs Queue)
  const startCloudProcessing = async () => {
    if (!file && type !== 'typewriter') {
      setErrorMsg(lang === 'tr' ? 'Lütfen bir resim veya video dosyası seçin.' : 'Please select an image or video file.');
      return;
    }
    if (!auth.currentUser) {
      setErrorMsg(lang === 'tr' ? 'Lütfen giriş yapın.' : 'Please log in.');
      return;
    }

    try {
      setStatus('uploading');
      const formData = new FormData();
      if (file) formData.append('file', file);

      const apiUrl = import.meta.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
      const uploadRes = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (Code: ${uploadRes.status}).`);
      }

      const uploadData = await uploadRes.json();
      const jobId = uploadData.job_id;

      setStatus('processing');
      const jobRef = doc(db, 'render_jobs', jobId);
      const params = {
        format_preset: formatPreset,
        hd_output: hdOutput,
        echo_count: echoCount,
        echo_decay: echoDecay,
        zoom_rate: zoomRate,
        zoom_direction: zoomDirection,
        pan_style: panStyle
      };

      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        tool_type: type,
        status: 'pending',
        created_at: serverTimestamp(),
        params: params
      });

      fetch(`${apiUrl}/jobs/ping`).catch(() => {});

      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'completed') {
            setResultUrl(`${apiUrl}${data.result_url}`);
            setStatus('completed');
            unsubscribe();
            handleSaveProject();
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

  const isServerTool = type === 'echo' || type === 'ken-burns' || type === 'vhs-tape';
  const effectTitle = type ? type.replace('-', ' ').toUpperCase() : '';

  return (
    <div className="w-full flex-grow flex flex-col h-full bg-bg-base text-white">
      <Helmet>
        <title>{`${effectTitle} - Free Online Video Tool | AnimationMaker`}</title>
        <meta name="description" content={`Create cinematic ${effectTitle} video animations directly in your browser with AnimationMaker.`} />
        <link rel="canonical" href={`https://animationmaker.m0s.space/effects/${type}`} />
      </Helmet>

      <div className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full relative z-10">
        
        {/* Header with Project Title & Cloud Sync */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              {effectTitle}
              <span className="text-xs px-2 py-0.5 bg-[#F5B301] text-black font-black rounded-md">PRO</span>
            </h1>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleSaveProject}
              placeholder="Project Name..."
              className="bg-transparent text-sm text-zinc-400 hover:text-white focus:text-white border-b border-transparent focus:border-[#F5B301] outline-none mt-1 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            {isSaving && <span className="text-xs text-zinc-400 animate-pulse">{t('saving', lang) || 'Saving...'}</span>}
            <button
              onClick={handleSaveProject}
              className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700 flex items-center gap-1.5"
            >
              ☁️ {t('saveDraft', lang) || 'Buluta Kaydet'}
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-0">
          
          {/* Left Column: Live Canvas Preview & Video Output */}
          <div className="lg:col-span-7 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center shadow-2xl relative min-h-[420px]">
            
            {status === 'completed' && resultUrl ? (
              <div className="flex flex-col items-center w-full">
                <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl mb-6">
                  <video src={resultUrl} controls autoPlay loop className="w-full h-auto" />
                </div>
                <div className="flex gap-4 w-full max-w-md">
                  <a
                    href={resultUrl}
                    download={`${projectName || type}.mp4`}
                    className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 font-bold rounded-xl text-center shadow-lg transition-all"
                  >
                    ⬇️ {t('downloadButton', lang) || 'Videoyu İndir'}
                  </a>
                  <button
                    onClick={() => { setStatus('idle'); setResultUrl(''); setProgress(0); }}
                    className="px-5 py-3.5 bg-zinc-800 hover:bg-zinc-700 font-bold rounded-xl border border-zinc-700 transition-colors"
                  >
                    🔄 {t('reset', lang) || 'Yeniden'}
                  </button>
                </div>
              </div>
            ) : status === 'processing' || status === 'uploading' ? (
              <div className="flex flex-col items-center w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 animate-pulse">
                  {status === 'uploading' ? 'Uploading...' : (t('deviceRendering', lang) || 'Rendering on Device...')}
                </h2>
                <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden mb-3 relative shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#F5B301] via-yellow-400 to-amber-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between w-full text-sm font-mono text-zinc-400">
                  <span>{progress}%</span>
                  <span>{renderEngine === 'device' ? 'Zero Server Latency' : 'Cloud GPU Processing'}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                
                {/* Live Canvas Viewport */}
                <div className="w-full max-w-md aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-700/80 shadow-2xl relative mb-6 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={formatPreset === '9:16' ? 360 : 640}
                    height={formatPreset === '9:16' ? 640 : (formatPreset === '1:1' ? 640 : 360)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {/* File Uploader button (if media tool) */}
                {type !== 'typewriter' && (
                  <div className="w-full max-w-md flex items-center gap-3 mb-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition-colors text-zinc-300 truncate text-center"
                    >
                      📁 {file ? file.name : (lang === 'tr' ? 'Medyayı Değiştir (Resim/Video)' : 'Upload Custom Media')}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,video/mp4,video/quicktime"
                      className="hidden"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="w-full max-w-md flex flex-col gap-3">
                  {!isServerTool ? (
                    <button
                      onClick={startDeviceRender}
                      className="w-full py-4 bg-gradient-to-r from-[#F5B301] to-[#FF9D00] hover:from-yellow-400 hover:to-yellow-500 rounded-2xl font-black text-black text-lg shadow-[0_0_25px_rgba(245,179,1,0.3)] transition-all active:scale-[0.98]"
                    >
                      ⚡ {t('renderDeviceBtn', lang) || 'Cihazda Oluştur (Anında)'}
                    </button>
                  ) : (
                    <button
                      onClick={startCloudProcessing}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-black text-white text-lg shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all active:scale-[0.98]"
                    >
                      ☁️ {t('renderCloudBtn', lang) || 'Bulutta 1080p Dışa Aktar'}
                    </button>
                  )}
                </div>

                {errorMsg && (
                  <div className="mt-4 w-full max-w-md bg-red-950/40 border border-red-500/40 p-3.5 rounded-xl text-red-400 text-sm">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Interactive Settings Panel */}
          <div className="lg:col-span-5 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar">
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-zinc-200">
              ⚙️ {t('settingsTitle', lang) || 'Efekt Ayarları'}
            </h3>

            <div className="space-y-5">
              
              {/* Aspect Ratio Presets */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  {t('formatLabel', lang) || 'Video Formatı'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['16:9', '9:16', '1:1'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormatPreset(fmt)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        formatPreset === fmt
                          ? 'bg-[#F5B301] text-black shadow-md'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {fmt} {fmt === '16:9' ? 'YT' : fmt === '9:16' ? 'Reels' : 'Post'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tool 1: GLITCH MASTER CONTROLS */}
              {type === 'glitch-master' && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('glitchIntensityLabel', lang) || 'Bozulma Şiddeti'}</span>
                      <span className="text-[#F5B301]">{Math.round(glitchIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={glitchIntensity}
                      onChange={(e) => setGlitchIntensity(parseFloat(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('rgbShiftLabel', lang) || 'RGB Kanal Kayması'}</span>
                      <span className="text-[#F5B301]">{rgbShift}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      step="1"
                      value={rgbShift}
                      onChange={(e) => setRgbShift(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('sliceRateLabel', lang) || 'Yatay Dilimleme'}</span>
                      <span className="text-[#F5B301]">{sliceRate}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      step="1"
                      value={sliceRate}
                      onChange={(e) => setSliceRate(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>
                </div>
              )}

              {/* Tool 2: TYPEWRITER CONTROLS */}
              {type === 'typewriter' && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      {t('typewriterTextLabel', lang) || 'Animasyon Metni'}
                    </label>
                    <textarea
                      rows={3}
                      value={typewriterText}
                      onChange={(e) => setTypewriterText(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-[#F5B301]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('typingSpeedLabel', lang) || 'Yazma Hızı'}</span>
                      <span className="text-[#F5B301]">{typingSpeed} h/sn</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="35"
                      step="1"
                      value={typingSpeed}
                      onChange={(e) => setTypingSpeed(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      {t('cursorStyleLabel', lang) || 'İmleç Stili'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'block', label: '█ Blok' },
                        { id: 'line', label: '| Çizgi' },
                        { id: 'underscore', label: '_ Altçizgi' }
                      ].map(c => (
                        <button
                          key={c.id}
                          onClick={() => setCursorStyle(c.id)}
                          className={`py-2 rounded-lg text-xs font-medium ${cursorStyle === c.id ? 'bg-[#F5B301] text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 3: SCANLINE CRT CONTROLS */}
              {type === 'scanline' && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('scanlineDensityLabel', lang) || 'Çizgi Sıklığı'}</span>
                      <span className="text-[#F5B301]">{scanlineDensity}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={scanlineDensity}
                      onChange={(e) => setScanlineDensity(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('phosphorGlowLabel', lang) || 'Fosfor Parıltısı'}</span>
                      <span className="text-[#F5B301]">{Math.round(phosphorGlow * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={phosphorGlow}
                      onChange={(e) => setPhosphorGlow(parseFloat(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>
                </div>
              )}

              {/* Tool 4: ASCII MATRIX CONTROLS */}
              {type === 'ascii' && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">
                      {t('asciiThemeLabel', lang) || 'Renk Paleti'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'matrixGreen', label: '🟢 Matrix Green' },
                        { id: 'cyberNeon', label: '🟣 Cyber Neon' },
                        { id: 'retroAmber', label: '🟠 Retro Amber' },
                        { id: 'trueColor', label: '🎨 True Color' }
                      ].map(tObj => (
                        <button
                          key={tObj.id}
                          onClick={() => setAsciiTheme(tObj.id)}
                          className={`py-2 rounded-lg text-xs font-medium ${asciiTheme === tObj.id ? 'bg-[#F5B301] text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                        >
                          {tObj.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('asciiCharsetLabel', lang) || 'Çözünürlük (Piksel Ölçeği)'}</span>
                      <span className="text-[#F5B301]">{asciiResolution}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="20"
                      step="2"
                      value={asciiResolution}
                      onChange={(e) => setAsciiResolution(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>
                </div>
              )}

              {/* Tool 5: ECHO MOTION CONTROLS */}
              {type === 'echo' && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('echoCountLabel', lang) || 'Yankı Kare Sayısı'}</span>
                      <span className="text-[#F5B301]">{echoCount} kare</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={echoCount}
                      onChange={(e) => setEchoCount(parseInt(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1.5">
                      <span>{t('echoDecayLabel', lang) || 'İz Sönümleme Oranı'}</span>
                      <span className="text-[#F5B301]">{Math.round(echoDecay * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.95"
                      step="0.05"
                      value={echoDecay}
                      onChange={(e) => setEchoDecay(parseFloat(e.target.value))}
                      className="w-full accent-[#F5B301]"
                    />
                  </div>
                </div>
              )}

              {/* Pro 1080p Toggle */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    1080p Full HD Export
                    <span className="text-[10px] bg-[#F5B301] text-black px-1.5 py-0.5 rounded font-black">PRO</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">Crystal clear resolution</div>
                </div>
                <input
                  type="checkbox"
                  checked={hdOutput}
                  onChange={(e) => setHdOutput(e.target.checked)}
                  className="w-5 h-5 accent-[#F5B301] cursor-pointer"
                />
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

