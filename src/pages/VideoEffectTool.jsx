import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Sliders,
  Upload,
  Play,
  RotateCcw,
  Download,
  Check,
  Edit2,
  Radio,
  Volume2
} from 'lucide-react';
import { createVideoFromFrames, extractAudioFromVideo } from '../lib/ffmpeg';
import { applyAudioEffect } from '../lib/audioUtils';
import {
  drawKenBurnsFrame,
  drawVhsEffect,
  drawGlitchEffect,
  drawTypewriterFrame,
  drawScanlineEffect,
  drawAsciiEffect,
  drawImageCover,
  drawVignette
} from '../renderer/effects';

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
}

export default function VideoEffectTool() {
  const { type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const lang = useSettingsStore(state => state.lang);
  const { user, saveProject, projects } = useAuthStore();

  const [projectId, setProjectId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const titleInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileDuration, setFileDuration] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [progress, setProgress] = useState(0);

  // Common Settings
  const [formatPreset, setFormatPreset] = useState('16:9'); // '16:9' | '9:16' | '1:1'
  const [hdOutput, setHdOutput] = useState(false);
  const [duration, setDuration] = useState(5); // in seconds (3 - 300)
  const [audioFxEnabled, setAudioFxEnabled] = useState(true);

  // 1. Ken Burns Settings
  const [zoomRate, setZoomRate] = useState(0.04);
  const [zoomDirection, setZoomDirection] = useState('in'); // 'in' | 'out'
  const [panStyle, setPanStyle] = useState('center'); // 'center', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'

  // 2. VHS Tape Settings
  const [aberrationStrength, setAberrationStrength] = useState(1.2);
  const [trackingNoise, setTrackingNoise] = useState('medium'); // 'low' | 'medium' | 'high'
  const [scanlineFlicker, setScanlineFlicker] = useState(true);
  const [vhsTimestamp, setVhsTimestamp] = useState(true);

  // 3. Glitch Master Settings
  const [glitchIntensity, setGlitchIntensity] = useState(0.6);
  const [rgbShift, setRgbShift] = useState(14);
  const [sliceRate, setSliceRate] = useState(8);

  // 4. Typewriter Settings
  const [typewriterText, setTypewriterText] = useState(
    lang === 'tr'
      ? "Her hikaye tek bir kelimeyle başlar.\nAnimationMaker büyüleyici videolar üretir."
      : "Every story begins with a single word.\nAnimationMaker creates the magic."
  );
  const [typingSpeed, setTypingSpeed] = useState(18); // chars per sec
  const [cursorStyle, setCursorStyle] = useState('block'); // 'block' | 'line' | 'underscore'
  const [fontColor, setFontColor] = useState('#FFFFFF');

  // 5. Scanline CRT Settings
  const [scanlineDensity, setScanlineDensity] = useState(4);
  const [phosphorGlow, setPhosphorGlow] = useState(0.5);

  // 6. ASCII Matrix Settings
  const [asciiTheme, setAsciiTheme] = useState('matrixGreen'); // 'matrixGreen' | 'cyberNeon' | 'retroAmber' | 'trueColor'
  const [asciiResolution, setAsciiResolution] = useState(12);

  // 7. Echo Motion Settings
  const [echoCount, setEchoCount] = useState(5);
  const [echoDecay, setEchoDecay] = useState(0.7);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const sourceMediaRef = useRef(null);
  const hasInitialized = useRef(false);

  const validTypes = ['ken-burns', 'vhs-tape', 'glitch-master', 'typewriter', 'scanline', 'ascii', 'echo'];

  // Route validation
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

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

  // 1. Load Draft / Restore Project (from query param or localStorage or cloud projects)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const draftId = searchParams.get('draft');

    if (!draftId && (!hasInitialized.current || projectId)) {
      hasInitialized.current = true;
      setProjectId(null);
      return;
    }

    if (draftId && draftId !== projectId) {
      hasInitialized.current = true;
      const savedDraft = localStorage.getItem('draft_project');
      if (savedDraft) {
        try {
          const draftData = JSON.parse(savedDraft);
          if (draftData.id === draftId) {
            setProjectId(draftData.id);
            if (draftData.projectName) setProjectName(draftData.projectName);
            if (draftData.formatPreset) setFormatPreset(draftData.formatPreset);
            if (draftData.hdOutput !== undefined) setHdOutput(draftData.hdOutput);
            if (draftData.duration) setDuration(draftData.duration);
            if (draftData.zoomRate) setZoomRate(draftData.zoomRate);
            if (draftData.zoomDirection) setZoomDirection(draftData.zoomDirection);
            if (draftData.panStyle) setPanStyle(draftData.panStyle);
            if (draftData.aberrationStrength) setAberrationStrength(draftData.aberrationStrength);
            if (draftData.trackingNoise) setTrackingNoise(draftData.trackingNoise);
            if (draftData.scanlineFlicker !== undefined) setScanlineFlicker(draftData.scanlineFlicker);
            if (draftData.vhsTimestamp !== undefined) setVhsTimestamp(draftData.vhsTimestamp);
            if (draftData.glitchIntensity) setGlitchIntensity(draftData.glitchIntensity);
            if (draftData.rgbShift) setRgbShift(draftData.rgbShift);
            if (draftData.sliceRate) setSliceRate(draftData.sliceRate);
            if (draftData.typewriterText) setTypewriterText(draftData.typewriterText);
            if (draftData.typingSpeed) setTypingSpeed(draftData.typingSpeed);
            if (draftData.cursorStyle) setCursorStyle(draftData.cursorStyle);
            if (draftData.scanlineDensity) setScanlineDensity(draftData.scanlineDensity);
            if (draftData.phosphorGlow) setPhosphorGlow(draftData.phosphorGlow);
            if (draftData.asciiTheme) setAsciiTheme(draftData.asciiTheme);
            if (draftData.asciiResolution) setAsciiResolution(draftData.asciiResolution);
            if (draftData.echoCount) setEchoCount(draftData.echoCount);
            if (draftData.echoDecay) setEchoDecay(draftData.echoDecay);
            localStorage.removeItem('draft_project');
            return;
          }
        } catch (e) {
          console.error("Draft parsing error", e);
        }
      }

      if (projects && projects.length > 0) {
        const cloudDraft = projects.find(p => p.id === draftId);
        if (cloudDraft && cloudDraft.settings) {
          const s = cloudDraft.settings;
          setProjectId(cloudDraft.id);
          if (s.projectName) setProjectName(s.projectName);
          if (s.formatPreset) setFormatPreset(s.formatPreset);
          if (s.hdOutput !== undefined) setHdOutput(s.hdOutput);
          if (s.duration) setDuration(s.duration);
          if (s.zoomRate) setZoomRate(s.zoomRate);
          if (s.zoomDirection) setZoomDirection(s.zoomDirection);
          if (s.panStyle) setPanStyle(s.panStyle);
          if (s.aberrationStrength) setAberrationStrength(s.aberrationStrength);
          if (s.trackingNoise) setTrackingNoise(s.trackingNoise);
          if (s.scanlineFlicker !== undefined) setScanlineFlicker(s.scanlineFlicker);
          if (s.vhsTimestamp !== undefined) setVhsTimestamp(s.vhsTimestamp);
          if (s.glitchIntensity) setGlitchIntensity(s.glitchIntensity);
          if (s.rgbShift) setRgbShift(s.rgbShift);
          if (s.sliceRate) setSliceRate(s.sliceRate);
          if (s.typewriterText) setTypewriterText(s.typewriterText);
          if (s.typingSpeed) setTypingSpeed(s.typingSpeed);
          if (s.cursorStyle) setCursorStyle(s.cursorStyle);
          if (s.scanlineDensity) setScanlineDensity(s.scanlineDensity);
          if (s.phosphorGlow) setPhosphorGlow(s.phosphorGlow);
          if (s.asciiTheme) setAsciiTheme(s.asciiTheme);
          if (s.asciiResolution) setAsciiResolution(s.asciiResolution);
          if (s.echoCount) setEchoCount(s.echoCount);
          if (s.echoDecay) setEchoDecay(s.echoDecay);
        }
      }
    }
  }, [location.search, projects, projectId]);

  // 2. Debounced Auto-Save to Firestore (1.5s debounce matching MatchCutTool)
  useEffect(() => {
    if (!user) return;

    const timeoutId = setTimeout(async () => {
      setSaveStatus(lang === 'tr' ? 'Kaydediliyor...' : 'Saving...');
      const projectSettings = {
        projectName: projectName.trim() || `${type} Project`,
        formatPreset,
        hdOutput,
        duration,
        zoomRate,
        zoomDirection,
        panStyle,
        aberrationStrength,
        trackingNoise,
        scanlineFlicker,
        vhsTimestamp,
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
        echoDecay
      };

      // Clean undefined keys for Firestore
      Object.keys(projectSettings).forEach(key => {
        if (projectSettings[key] === undefined) {
          delete projectSettings[key];
        }
      });

      let targetProjectId = projectId;
      if (!targetProjectId && projectSettings.projectName) {
        const existingDuplicate = projects.find(p => p.toolId === type && p.settings?.projectName === projectSettings.projectName);
        if (existingDuplicate) {
          targetProjectId = existingDuplicate.id;
        }
      }

      try {
        const savedId = await saveProject(type, projectSettings, targetProjectId);
        if (savedId && savedId !== projectId) {
          setProjectId(savedId);
          navigate(`?draft=${savedId}`, { replace: true });
        }
        setSaveStatus(lang === 'tr' ? 'Buluta Kaydedildi' : 'Saved to Cloud');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus('');
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [
    user, type, projectId, projectName, formatPreset, hdOutput, duration,
    zoomRate, zoomDirection, panStyle, aberrationStrength, trackingNoise, scanlineFlicker, vhsTimestamp,
    glitchIntensity, rgbShift, sliceRate, typewriterText, typingSpeed, cursorStyle, fontColor,
    scanlineDensity, phosphorGlow, asciiTheme, asciiResolution, echoCount, echoDecay,
    saveProject, projects, navigate, lang
  ]);

  // Handle File Upload & Duration Detection
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
          setFileDuration(null);
        };
      } else if (selectedFile.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.src = url;
        vid.crossOrigin = 'anonymous';
        vid.loop = true;
        vid.muted = true;
        vid.onloadedmetadata = () => {
          if (vid.duration && !isNaN(vid.duration)) {
            const detectedSec = Math.min(300, Math.max(3, Math.round(vid.duration)));
            setFileDuration(vid.duration);
            setDuration(detectedSec);
          }
        };
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
      grad.addColorStop(0, '#16171E');
      grad.addColorStop(0.5, '#1E202B');
      grad.addColorStop(1, '#0F1015');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 640, 360);

      sCtx.fillStyle = '#FFFFFF';
      sCtx.font = '800 32px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('ANIMATIONMAKER', 320, 165);
      sCtx.fillStyle = '#F5B301';
      sCtx.font = '700 16px monospace';
      sCtx.fillText(`[ ${type.toUpperCase().replace('-', ' ')} ]`, 320, 205);
      
      sourceMediaRef.current = sampleCanvas;
    }
  }, [fileUrl, type]);

  // Live Canvas Interactive Preview Loop (Smooth 60fps)
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
        const loopDuration = Math.max(3, duration);
        const progress = (elapsed % loopDuration) / loopDuration;

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, width, height, progress, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            darkTheme: true
          });
        } else if (type === 'ken-burns') {
          drawKenBurnsFrame(ctx, sourceMediaRef.current, width, height, progress, {
            zoomRate,
            zoomDirection,
            panStyle
          });
        } else if (type === 'vhs-tape') {
          drawVhsEffect(ctx, sourceMediaRef.current, width, height, progress, {
            aberrationStrength,
            trackingNoise,
            scanlineFlicker,
            vhsTimestamp
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
        } else if (type === 'echo') {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, width, height);
          if (sourceMediaRef.current) {
            ctx.save();
            const scale = 1 + (progress * 0.12);
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, width, height, scale);
            drawVignette(ctx, width, height, 0.4);
            ctx.restore();
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
    type, duration, typewriterText, fontColor, cursorStyle,
    zoomRate, zoomDirection, panStyle,
    aberrationStrength, trackingNoise, scanlineFlicker, vhsTimestamp,
    glitchIntensity, rgbShift, sliceRate,
    scanlineDensity, phosphorGlow, asciiTheme, asciiResolution
  ]);

  // Client-Side Device Render (FFmpeg WASM & Canvas Frames with Audio Preservation)
  const startDeviceRender = async () => {
    try {
      setStatus('processing');
      setProgress(2);
      setErrorMsg('');

      // 1. Extract and process audio if the source is a video file
      let audioBlob = null;
      if (file && file.type.startsWith('video/')) {
        setProgress(4);
        const rawAudioBlob = await extractAudioFromVideo(file);
        if (rawAudioBlob) {
          setProgress(7);
          if (audioFxEnabled && ['vhs-tape', 'scanline', 'glitch-master'].includes(type)) {
            audioBlob = await applyAudioEffect(rawAudioBlob, type, {
              intensity: glitchIntensity,
              aberrationStrength: aberrationStrength,
              scanlineDensity: scanlineDensity
            });
          } else {
            audioBlob = rawAudioBlob;
          }
        }
      }

      const canvas = document.createElement('canvas');
      const [wRatio, hRatio] = formatPreset.split(':').map(Number);
      const baseWidth = hdOutput ? 1080 : 720;
      canvas.width = baseWidth;
      canvas.height = Math.round((baseWidth / wRatio) * hRatio);
      if (canvas.height % 2 !== 0) canvas.height += 1;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const fps = 30;
      const totalDuration = type === 'typewriter'
        ? Math.max(3, Math.ceil(typewriterText.length / typingSpeed) + 1)
        : duration;
      const totalFrames = Math.round(fps * totalDuration);
      const frames = [];

      const videoElement = sourceMediaRef.current instanceof HTMLVideoElement ? sourceMediaRef.current : null;

      for (let i = 0; i < totalFrames; i++) {
        const frameProgress = i / totalFrames;

        // Sync video frame accurate timestamp
        if (videoElement) {
          videoElement.currentTime = frameProgress * totalDuration;
          await new Promise((resolve) => {
            const onSeeked = () => {
              videoElement.removeEventListener('seeked', onSeeked);
              resolve();
            };
            videoElement.addEventListener('seeked', onSeeked);
            setTimeout(resolve, 40);
          });
        }

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, canvas.width, canvas.height, frameProgress, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            darkTheme: true
          });
        } else if (type === 'ken-burns') {
          drawKenBurnsFrame(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            zoomRate,
            zoomDirection,
            panStyle
          });
        } else if (type === 'vhs-tape') {
          drawVhsEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            aberrationStrength,
            trackingNoise,
            scanlineFlicker,
            vhsTimestamp
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
        } else if (type === 'echo') {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (sourceMediaRef.current) {
            const scale = 1 + (frameProgress * 0.12);
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, canvas.width, canvas.height, scale);
            drawVignette(ctx, canvas.width, canvas.height, 0.4);
          }
        } else {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (sourceMediaRef.current) {
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, canvas.width, canvas.height, 1.0);
          }
        }

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        const arrayBuf = await blob.arrayBuffer();
        frames.push(new Uint8Array(arrayBuf));

        if (i % 5 === 0) {
          setProgress(Math.round(5 + (i / totalFrames) * 45));
        }
      }

      setProgress(52);
      const videoUrl = await createVideoFromFrames(frames, audioBlob, fps, hdOutput, (p) => {
        setProgress(Math.round(p));
      });

      setResultUrl(videoUrl);
      setStatus('completed');
    } catch (err) {
      console.error("Device render error:", err);
      setErrorMsg(err.message || 'Render failed on device.');
      setStatus('error');
    }
  };

  // Cloud Processing Fallback (Firebase render_jobs Queue)
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
        duration: duration,
        echo_count: echoCount,
        echo_decay: echoDecay,
        zoom_rate: zoomRate,
        zoom_direction: zoomDirection,
        pan_style: panStyle,
        aberration_strength: aberrationStrength
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

  const isServerTool = type === 'echo';
  const effectTitle = type ? type.replace('-', ' ').toUpperCase() : '';

  return (
    <div className="w-full flex-grow flex flex-col h-full bg-bg-base text-text-primary">
      <Helmet>
        <title>{`${effectTitle} - Video Effects Suite | AnimationMaker`}</title>
        <meta name="description" content={`Create cinematic ${effectTitle} video animations directly in your browser with AnimationMaker.`} />
        <link rel="canonical" href={`https://animationmaker.m0s.space/effects/${type}`} />
      </Helmet>

      <div className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full relative z-10">
        
        {/* Header with Inline Editable Title & Cloud Sync (Identical to MatchCutTool) */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-5">
          <div>
            <AnimatePresence mode="wait">
              {isEditingName ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 mb-1"
                >
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    placeholder="Project Name..."
                    className="bg-surface border border-border-color focus:border-accent-gold text-white text-xl sm:text-2xl font-bold px-3 py-1 rounded-xl outline-none w-full max-w-[320px]"
                    autoFocus
                  />
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-2 bg-accent-gold text-black rounded-xl hover:bg-yellow-400 transition-colors"
                  >
                    <Check size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 mb-1 group cursor-pointer w-fit"
                  onClick={() => setIsEditingName(true)}
                >
                  <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                    {projectName || effectTitle}
                    <span className="text-[11px] px-2 py-0.5 bg-accent-gold text-black font-black rounded-md tracking-wider">
                      PRO
                    </span>
                  </h1>
                  {user && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-surface-light border border-border-color rounded-lg text-text-muted hover:text-white">
                      <Edit2 size={14} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-text-muted text-xs sm:text-sm">
              {t(`tool_${type.replace('-', '')}_desc`, lang) || `${effectTitle} effect studio for cinematic video creation`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-text-secondary font-medium px-2.5 py-1 bg-surface-light border border-border-color rounded-lg"
              >
                {saveStatus}
              </motion.span>
            )}
            <div className="text-xs font-mono text-text-muted flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-color rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isServerTool ? 'Cloud Worker' : 'On-Device Engine'}
            </div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-0">
          
          {/* Left Column: Modern Studio Preview Viewport */}
          <div className="lg:col-span-7 bg-surface border border-border-color rounded-3xl p-6 flex flex-col items-center justify-between shadow-2xl relative min-h-[460px]">
            
            {/* Top Viewport Status Bar */}
            <div className="w-full flex items-center justify-between text-xs text-text-muted mb-4 border-b border-border-color/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-surface-light border border-border-color rounded font-mono font-bold text-text-secondary">
                  {formatPreset}
                </span>
                <span>{hdOutput ? '1080p Full HD' : '720p HD'}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                <Radio size={13} className="animate-pulse" />
                <span>LIVE PREVIEW</span>
              </div>
            </div>

            {status === 'completed' && resultUrl ? (
              <div className="flex flex-col items-center w-full my-auto">
                <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden border border-border-color shadow-2xl mb-6">
                  <video src={resultUrl} controls autoPlay loop className="w-full h-auto" />
                </div>
                <div className="flex gap-3 w-full max-w-md">
                  <a
                    href={resultUrl}
                    download={`${projectName || type}.mp4`}
                    className="flex-1 py-3.5 bg-accent-gold hover:bg-yellow-400 text-black font-bold rounded-xl text-center shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    {t('downloadButton', lang) || 'Download Video'}
                  </a>
                  <button
                    onClick={() => { setStatus('idle'); setResultUrl(''); setProgress(0); }}
                    className="px-4 py-3.5 bg-surface-light hover:bg-zinc-800 text-text-primary font-bold rounded-xl border border-border-color transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={16} />
                    {t('reset', lang) || 'Reset'}
                  </button>
                </div>
              </div>
            ) : status === 'processing' || status === 'uploading' ? (
              <div className="flex flex-col items-center w-full max-w-md my-auto">
                <div className="w-12 h-12 rounded-2xl bg-surface-light border border-border-color flex items-center justify-center text-accent-gold mb-4 animate-pulse">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-xl font-bold text-white mb-6">
                  {status === 'uploading' ? 'Uploading Media...' : 'Rendering Video...'}
                </h2>
                <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden mb-3 relative border border-border-color">
                  <div
                    className="h-full bg-accent-gold transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between w-full text-xs font-mono text-text-muted">
                  <span>{progress}%</span>
                  <span>{isServerTool ? 'Server Queue' : 'Browser FFmpeg WASM'}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full my-auto">
                
                {/* Canvas Viewport Frame with Aspect-Ratio Containment */}
                <div
                  className={`w-full max-w-md bg-black rounded-2xl overflow-hidden border border-border-color shadow-2xl relative mb-5 flex items-center justify-center ${
                    formatPreset === '9:16' ? 'aspect-[9/16] max-h-[380px]' : formatPreset === '1:1' ? 'aspect-square max-h-[340px]' : 'aspect-video'
                  }`}
                >
                  <canvas
                    ref={canvasRef}
                    width={formatPreset === '9:16' ? 360 : 640}
                    height={formatPreset === '9:16' ? 640 : (formatPreset === '1:1' ? 640 : 360)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {/* Media Uploader Button (if not purely text tool) */}
                {type !== 'typewriter' && (
                  <div className="w-full max-w-md mb-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2.5 px-4 bg-surface-light hover:bg-zinc-800 border border-border-color rounded-xl text-xs font-semibold transition-colors text-text-secondary flex items-center justify-center gap-2 truncate"
                      >
                        <Upload size={14} />
                        {file ? file.name : (lang === 'tr' ? 'Medyayı Değiştir (Görsel/Video)' : 'Upload Media (Photo/Video)')}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={type === 'ken-burns' ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,image/jpeg,image/png,image/webp"}
                        className="hidden"
                      />
                    </div>
                    {file && file.type.startsWith('video/') && (
                      <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 mt-2 px-1">
                        <span className="flex items-center gap-1.5">
                          <Volume2 size={13} />
                          {lang === 'tr' ? 'Orijinal Ses Dahil Edilecek' : 'Original Audio Included'}
                        </span>
                        {fileDuration && (
                          <span className="text-text-muted">
                            {lang === 'tr' ? 'Video:' : 'Source:'} {formatDuration(Math.round(fileDuration))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action CTA */}
                <div className="w-full max-w-md">
                  {!isServerTool ? (
                    <button
                      onClick={startDeviceRender}
                      className="w-full py-3.5 bg-accent-gold hover:bg-yellow-400 rounded-xl font-bold text-black text-sm shadow-[0_0_25px_rgba(245,179,1,0.25)] transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      <Play size={16} fill="black" />
                      {lang === 'tr' ? 'Videoyu Cihazda Oluştur' : 'Render Video on Device'}
                    </button>
                  ) : (
                    <button
                      onClick={startCloudProcessing}
                      className="w-full py-3.5 bg-accent-gold hover:bg-yellow-400 rounded-xl font-bold text-black text-sm shadow-[0_0_25px_rgba(245,179,1,0.25)] transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      <Play size={16} fill="black" />
                      {lang === 'tr' ? 'Bulutta Oluştur (1080p)' : 'Render in Cloud (1080p)'}
                    </button>
                  )}
                </div>

                {errorMsg && (
                  <div className="mt-4 w-full max-w-md bg-red-950/30 border border-red-500/30 p-3 rounded-xl text-red-400 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Settings Panel */}
          <div className="lg:col-span-5 bg-surface border border-border-color rounded-3xl p-6 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar">
            <h3 className="text-base font-bold mb-5 flex items-center gap-2 text-text-primary">
              <Sliders size={18} className="text-accent-gold" />
              {t('settingsTitle', lang) || 'Effect Controls'}
            </h3>

            <div className="space-y-5">
              
              {/* Aspect Ratio Presets */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">
                  {t('formatLabel', lang) || 'Aspect Ratio'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['16:9', '9:16', '1:1'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormatPreset(fmt)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        formatPreset === fmt
                          ? 'bg-accent-gold text-black border-accent-gold shadow-md'
                          : 'bg-surface-light text-text-secondary border-border-color hover:text-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Duration Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                  <span>{lang === 'tr' ? 'Video Süresi (Max 5 Dk)' : 'Video Duration (Max 5 Min)'}</span>
                  <span className="text-accent-gold font-mono font-bold">{formatDuration(duration)}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="300"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full accent-accent-gold"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[5, 15, 30, 60, 180, 300].map(s => (
                    <button
                      key={s}
                      onClick={() => setDuration(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors ${
                        duration === s
                          ? 'bg-accent-gold text-black border-accent-gold'
                          : 'bg-surface-light text-text-muted border-border-color hover:text-white'
                      }`}
                    >
                      {s >= 60 ? `${s / 60}m` : `${s}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. KEN BURNS GRANULAR CONTROLS */}
              {type === 'ken-burns' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {lang === 'tr' ? 'Yakınlaştırma Yönü' : 'Zoom Direction'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'in', label: lang === 'tr' ? 'Yakınlaş (In)' : 'Zoom In' },
                        { id: 'out', label: lang === 'tr' ? 'Uzaklaş (Out)' : 'Zoom Out' }
                      ].map(z => (
                        <button
                          key={z.id}
                          onClick={() => setZoomDirection(z.id)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            zoomDirection === z.id
                              ? 'bg-accent-gold text-black border-accent-gold'
                              : 'bg-surface-light text-text-secondary border-border-color hover:text-white'
                          }`}
                        >
                          {z.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {lang === 'tr' ? 'Kamera Kaydırma (Pan)' : 'Camera Pan Style'}
                    </label>
                    <select
                      value={panStyle}
                      onChange={(e) => setPanStyle(e.target.value)}
                      className="w-full bg-surface-light border border-border-color rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent-gold"
                    >
                      <option value="center">{lang === 'tr' ? 'Merkez (Sabit)' : 'Center (No Pan)'}</option>
                      <option value="left_to_right">{lang === 'tr' ? 'Soldan Sağa' : 'Left to Right'}</option>
                      <option value="right_to_left">{lang === 'tr' ? 'Sağdan Sola' : 'Right to Left'}</option>
                      <option value="top_to_bottom">{lang === 'tr' ? 'Yukarıdan Aşağıya' : 'Top to Bottom'}</option>
                      <option value="bottom_to_top">{lang === 'tr' ? 'Aşağıdan Yukarıya' : 'Bottom to Top'}</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{lang === 'tr' ? 'Yakınlaştırma Hızı' : 'Zoom Rate'}</span>
                      <span className="text-accent-gold font-mono">{zoomRate}</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.10"
                      step="0.01"
                      value={zoomRate}
                      onChange={(e) => setZoomRate(parseFloat(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>
                </div>
              )}

              {/* 2. VHS TAPE GRANULAR CONTROLS */}
              {type === 'vhs-tape' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{lang === 'tr' ? 'Renk Bozulması (Aberration)' : 'Chromatic Aberration'}</span>
                      <span className="text-accent-gold font-mono">{aberrationStrength}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={aberrationStrength}
                      onChange={(e) => setAberrationStrength(parseFloat(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {lang === 'tr' ? 'Bant Parazit Yoğunluğu' : 'Tracking Noise Level'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['low', 'medium', 'high'].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setTrackingNoise(lvl)}
                          className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                            trackingNoise === lvl
                              ? 'bg-accent-gold text-black border-accent-gold'
                              : 'bg-surface-light text-text-secondary border-border-color hover:text-white'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold text-text-secondary">
                      {lang === 'tr' ? 'Retro Zaman Damgası (OSD)' : 'VCR OSD Timestamp'}
                    </span>
                    <input
                      type="checkbox"
                      checked={vhsTimestamp}
                      onChange={(e) => setVhsTimestamp(e.target.checked)}
                      className="w-4 h-4 accent-accent-gold cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-secondary">
                      {lang === 'tr' ? 'Tarama Çizgisi Titremesi' : 'Scanline Flicker'}
                    </span>
                    <input
                      type="checkbox"
                      checked={scanlineFlicker}
                      onChange={(e) => setScanlineFlicker(e.target.checked)}
                      className="w-4 h-4 accent-accent-gold cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* 3. GLITCH MASTER CONTROLS */}
              {type === 'glitch-master' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('glitchIntensityLabel', lang) || 'Glitch Intensity'}</span>
                      <span className="text-accent-gold font-mono">{Math.round(glitchIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={glitchIntensity}
                      onChange={(e) => setGlitchIntensity(parseFloat(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('rgbShiftLabel', lang) || 'RGB Color Split'}</span>
                      <span className="text-accent-gold font-mono">{rgbShift}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      step="1"
                      value={rgbShift}
                      onChange={(e) => setRgbShift(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('sliceRateLabel', lang) || 'Slice Slicing'}</span>
                      <span className="text-accent-gold font-mono">{sliceRate}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      step="1"
                      value={sliceRate}
                      onChange={(e) => setSliceRate(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>
                </div>
              )}

              {/* 4. TYPEWRITER CONTROLS */}
              {type === 'typewriter' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {t('typewriterTextLabel', lang) || 'Text to Animate'}
                    </label>
                    <textarea
                      rows={3}
                      value={typewriterText}
                      onChange={(e) => setTypewriterText(e.target.value)}
                      className="w-full bg-surface-light border border-border-color rounded-xl p-3 text-xs text-white outline-none focus:border-accent-gold font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('typingSpeedLabel', lang) || 'Typing Speed'}</span>
                      <span className="text-accent-gold font-mono">{typingSpeed} chars/s</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="35"
                      step="1"
                      value={typingSpeed}
                      onChange={(e) => setTypingSpeed(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {t('cursorStyleLabel', lang) || 'Cursor Style'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'block', label: 'Block' },
                        { id: 'line', label: 'Line' },
                        { id: 'underscore', label: 'Underscore' }
                      ].map(c => (
                        <button
                          key={c.id}
                          onClick={() => setCursorStyle(c.id)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            cursorStyle === c.id
                              ? 'bg-accent-gold text-black border-accent-gold'
                              : 'bg-surface-light text-text-secondary border-border-color hover:text-white'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SCANLINE CRT CONTROLS */}
              {type === 'scanline' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('scanlineDensityLabel', lang) || 'Scanline Density'}</span>
                      <span className="text-accent-gold font-mono">{scanlineDensity}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={scanlineDensity}
                      onChange={(e) => setScanlineDensity(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('phosphorGlowLabel', lang) || 'Phosphor Glow'}</span>
                      <span className="text-accent-gold font-mono">{Math.round(phosphorGlow * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={phosphorGlow}
                      onChange={(e) => setPhosphorGlow(parseFloat(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>
                </div>
              )}

              {/* 6. ASCII MATRIX CONTROLS */}
              {type === 'ascii' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-2">
                      {t('asciiThemeLabel', lang) || 'Color Palette'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'matrixGreen', label: 'Matrix Green' },
                        { id: 'cyberNeon', label: 'Cyber Neon' },
                        { id: 'retroAmber', label: 'Retro Amber' },
                        { id: 'trueColor', label: 'True Color' }
                      ].map(tObj => (
                        <button
                          key={tObj.id}
                          onClick={() => setAsciiTheme(tObj.id)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            asciiTheme === tObj.id
                              ? 'bg-accent-gold text-black border-accent-gold'
                              : 'bg-surface-light text-text-secondary border-border-color hover:text-white'
                          }`}
                        >
                          {tObj.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('asciiCharsetLabel', lang) || 'Pixel Cell Size'}</span>
                      <span className="text-accent-gold font-mono">{asciiResolution}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="20"
                      step="2"
                      value={asciiResolution}
                      onChange={(e) => setAsciiResolution(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>
                </div>
              )}

              {/* 7. ECHO MOTION CONTROLS */}
              {type === 'echo' && (
                <div className="space-y-4 pt-4 border-t border-border-color">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('echoCountLabel', lang) || 'Echo Frames'}</span>
                      <span className="text-accent-gold font-mono">{echoCount}</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={echoCount}
                      onChange={(e) => setEchoCount(parseInt(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
                      <span>{t('echoDecayLabel', lang) || 'Motion Trail Decay'}</span>
                      <span className="text-accent-gold font-mono">{Math.round(echoDecay * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.95"
                      step="0.05"
                      value={echoDecay}
                      onChange={(e) => setEchoDecay(parseFloat(e.target.value))}
                      className="w-full accent-accent-gold"
                    />
                  </div>
                </div>
              )}

              {/* Thematic Audio FX Toggle (Glitch, CRT Scanline, VHS) */}
              {['vhs-tape', 'scanline', 'glitch-master'].includes(type) && (
                <div className="pt-4 border-t border-border-color flex items-center justify-between">
                  <div className="pr-3">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Volume2 size={13} className="text-accent-gold" />
                      {lang === 'tr' ? 'Tematik Ses Efekti (DSP)' : 'Thematic Audio FX'}
                      <span className="text-[10px] bg-surface-light text-accent-gold border border-border-color px-1.5 py-0.5 rounded font-mono">
                        {type === 'vhs-tape' ? 'VHS Tape' : type === 'scanline' ? 'CRT TV' : 'Glitch'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {type === 'vhs-tape'
                        ? (lang === 'tr' ? '90’lar analog kaset filtre ve doygunluğu' : '90s analog tape warmth & EQ')
                        : type === 'scanline'
                        ? (lang === 'tr' ? 'CRT TV hoparlör kutusu tınısı' : 'Vintage CRT TV speaker simulation')
                        : (lang === 'tr' ? 'Dijital overdrive ve crunch' : 'Digital glitch distortion overdrive')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={audioFxEnabled}
                    onChange={(e) => setAudioFxEnabled(e.target.checked)}
                    className="w-4 h-4 accent-accent-gold cursor-pointer flex-shrink-0"
                  />
                </div>
              )}

              {/* 1080p HD Output Toggle */}
              <div className="pt-4 border-t border-border-color flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    1080p Full HD
                    <span className="text-[10px] bg-accent-gold text-black px-1.5 py-0.5 rounded font-black">PRO</span>
                  </div>
                  <div className="text-[11px] text-text-muted">High bitrate export</div>
                </div>
                <input
                  type="checkbox"
                  checked={hdOutput}
                  onChange={(e) => setHdOutput(e.target.checked)}
                  className="w-4 h-4 accent-accent-gold cursor-pointer"
                />
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}


