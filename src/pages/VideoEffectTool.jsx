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
  Upload,
  Play,
  RotateCcw,
  Download,
  Check,
  Edit2,
  Volume2
} from 'lucide-react';
import Switch from '../components/Switch';
import SegmentedControl from '../components/SegmentedControl';
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
  const lastSavedSnapshotRef = useRef(null);

  const validTypes = ['ken-burns', 'vhs-tape', 'glitch-master', 'typewriter', 'scanline', 'ascii', 'echo'];

  // Route validation
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools');
    }
  }, [type, navigate]);

  // Tool Meta (Title & Description formatted like MatchCutTool)
  const toolMetaMap = {
    'ken-burns': {
      title1: 'Ken Burns',
      title2: 'Pro',
      desc: lang === 'tr' ? 'Sabit fotoğraflarınıza sinematik yakınlaşma ve kamera kaydırma hareketleri verin.' : 'Automated cinematic pan and zoom effects for your static images.'
    },
    'vhs-tape': {
      title1: 'VHS',
      title2: lang === 'tr' ? 'Kaset' : 'Tape',
      desc: lang === 'tr' ? '90’lar analog manyetik kaset gürültüsü, renk ayrışımı ve retro VCR damgası.' : 'Authentic 90s magnetic tape noise, chromatic aberration and VCR timestamp.'
    },
    'glitch-master': {
      title1: 'Glitch',
      title2: 'Master',
      desc: lang === 'tr' ? 'Siberparazit, RGB kanal kayması ve dinamik dijital dilimlenme bozulmaları.' : 'Cybernetic RGB channel shifting, scanline distortion, and slice artifacts.'
    },
    'typewriter': {
      title1: 'Typewriter',
      title2: lang === 'tr' ? 'Daktilo' : 'Effect',
      desc: lang === 'tr' ? 'Karakter karakter yazılan daktilo animasyonları ve şık tipografi.' : 'Terminal typewriter animation with customizable speed, fonts, and cursors.'
    },
    'scanline': {
      title1: 'CRT',
      title2: 'Scanline',
      desc: lang === 'tr' ? 'Nostaljik tüplü ekran tarama çizgileri, fosfor parıltısı ve CRT kutu tonlaması.' : 'Vintage arcade CRT television scanlines, phosphor glow, and screen curvature.'
    },
    'ascii': {
      title1: 'ASCII',
      title2: 'Matrix',
      desc: lang === 'tr' ? 'Görsel veya videolarınızı gerçek zamanlı Matrix kodlarına ve ASCII karakter sanatına dönüştürün.' : 'Real-time Matrix code rain and ASCII character density renderer.'
    },
    'echo': {
      title1: 'Echo',
      title2: 'Motion',
      desc: lang === 'tr' ? 'Görsel ve videolara rüya gibi hareket yankıları ve çoklu hayalet izleri ekleyin.' : 'Multi-layered ghost trails and motion echo effects for images and videos.'
    }
  };

  const toolInfo = toolMetaMap[type] || { title1: type, title2: 'Tool', desc: 'AnimationMaker Pro Video Effect' };

  // Helper to build settings object
  const getCurrentSettings = () => ({
    projectName: projectName.trim(),
    formatPreset,
    hdOutput,
    duration,
    audioFxEnabled,
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
  });

  // 1. Load Draft / Restore Project (from query param or localStorage or cloud projects)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const draftId = searchParams.get('draft');

    if (!draftId && (!hasInitialized.current || projectId)) {
      hasInitialized.current = true;
      setProjectId(null);
      setProjectName('');
      setFormatPreset('16:9');
      setHdOutput(false);
      setDuration(5);
      setAudioFxEnabled(true);
      setZoomRate(0.04);
      setZoomDirection('in');
      setPanStyle('center');
      setAberrationStrength(1.2);
      setTrackingNoise('medium');
      setScanlineFlicker(true);
      setVhsTimestamp(true);
      setGlitchIntensity(0.6);
      setRgbShift(14);
      setSliceRate(8);
      setTypingSpeed(18);
      setCursorStyle('block');
      setFontColor('#FFFFFF');
      setScanlineDensity(4);
      setPhosphorGlow(0.5);
      setAsciiTheme('matrixGreen');
      setAsciiResolution(12);
      setEchoCount(5);
      setEchoDecay(0.7);
      
      // Store baseline snapshot so auto-save doesn't fire immediately
      lastSavedSnapshotRef.current = JSON.stringify(getCurrentSettings());
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
            if (draftData.audioFxEnabled !== undefined) setAudioFxEnabled(draftData.audioFxEnabled);
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
            if (draftData.fontColor) setFontColor(draftData.fontColor);
            if (draftData.scanlineDensity) setScanlineDensity(draftData.scanlineDensity);
            if (draftData.phosphorGlow) setPhosphorGlow(draftData.phosphorGlow);
            if (draftData.asciiTheme) setAsciiTheme(draftData.asciiTheme);
            if (draftData.asciiResolution) setAsciiResolution(draftData.asciiResolution);
            if (draftData.echoCount) setEchoCount(draftData.echoCount);
            if (draftData.echoDecay) setEchoDecay(draftData.echoDecay);
            localStorage.removeItem('draft_project');
            lastSavedSnapshotRef.current = JSON.stringify(draftData);
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
          if (s.audioFxEnabled !== undefined) setAudioFxEnabled(s.audioFxEnabled);
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
          if (s.fontColor) setFontColor(s.fontColor);
          if (s.scanlineDensity) setScanlineDensity(s.scanlineDensity);
          if (s.phosphorGlow) setPhosphorGlow(s.phosphorGlow);
          if (s.asciiTheme) setAsciiTheme(s.asciiTheme);
          if (s.asciiResolution) setAsciiResolution(s.asciiResolution);
          if (s.echoCount) setEchoCount(s.echoCount);
          if (s.echoDecay) setEchoDecay(s.echoDecay);
          lastSavedSnapshotRef.current = JSON.stringify(s);
        }
      }
    }
  }, [location.search, projects, projectId]);

  // 2. Debounced Auto-Save to Firestore (ONLY when actual settings changed)
  useEffect(() => {
    if (!user || !hasInitialized.current) return;

    const currentSnapshot = JSON.stringify(getCurrentSettings());

    // Do NOT fire auto-save if settings have not changed from last save/load!
    if (lastSavedSnapshotRef.current === currentSnapshot) {
      return;
    }

    // Do NOT save if empty default project without custom name and no project ID
    const isUntouchedDefault = !projectName.trim() && !projectId && duration === 5 && formatPreset === '16:9' && !hdOutput;
    if (isUntouchedDefault) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSaveStatus(lang === 'tr' ? 'Kaydediliyor...' : 'Saving...');
      const projectSettings = getCurrentSettings();

      // Clean undefined keys for Firestore
      Object.keys(projectSettings).forEach(key => {
        if (projectSettings[key] === undefined) {
          delete projectSettings[key];
        }
      });

      let targetProjectId = projectId;
      if (!targetProjectId && projectSettings.projectName) {
        const existingDuplicate = projects?.find(p => p.toolId === type && p.settings?.projectName === projectSettings.projectName);
        if (existingDuplicate) {
          targetProjectId = existingDuplicate.id;
        }
      }

      try {
        const savedId = await saveProject(type, projectSettings, targetProjectId);
        lastSavedSnapshotRef.current = currentSnapshot;
        if (savedId && savedId !== projectId) {
          setProjectId(savedId);
          navigate(`?draft=${savedId}`, { replace: true });
        }
        setSaveStatus(lang === 'tr' ? 'Buluta Kaydedildi' : 'Saved to Cloud');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus('');
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timeoutId);
  }, [
    user, projectName, formatPreset, hdOutput, duration, audioFxEnabled,
    zoomRate, zoomDirection, panStyle, aberrationStrength, trackingNoise,
    scanlineFlicker, vhsTimestamp, glitchIntensity, rgbShift, sliceRate,
    typewriterText, typingSpeed, cursorStyle, fontColor, scanlineDensity,
    phosphorGlow, asciiTheme, asciiResolution, echoCount, echoDecay,
    lang, projectId, saveProject, type, projects, navigate
  ]);

  // Handle Media Upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);

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
        const progressVal = (elapsed % loopDuration) / loopDuration;

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, width, height, progressVal, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            darkTheme: true
          });
        } else if (type === 'ken-burns') {
          drawKenBurnsFrame(ctx, sourceMediaRef.current, width, height, progressVal, {
            zoomRate,
            zoomDirection,
            panStyle
          });
        } else if (type === 'vhs-tape') {
          drawVhsEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            aberrationStrength,
            trackingNoise,
            scanlineFlicker,
            vhsTimestamp
          });
        } else if (type === 'glitch-master') {
          drawGlitchEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            intensity: glitchIntensity,
            rgbShift,
            sliceRate
          });
        } else if (type === 'scanline') {
          drawScanlineEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            density: scanlineDensity,
            glow: phosphorGlow
          });
        } else if (type === 'ascii') {
          drawAsciiEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            theme: asciiTheme,
            resolution: asciiResolution
          });
        } else if (type === 'echo') {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, width, height);
          if (sourceMediaRef.current) {
            ctx.save();
            const scale = 1 + (progressVal * 0.12);
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

  // Cloud Processing (Firebase render_jobs Queue -> Render Worker API)
  const startCloudProcessing = async () => {
    if (!file && type !== 'typewriter') {
      setErrorMsg(lang === 'tr' ? 'Lütfen bir resim veya video dosyası seçin.' : 'Please select an image or video file.');
      return;
    }
    if (!auth.currentUser) {
      setErrorMsg(lang === 'tr' ? 'Bulut render için lütfen giriş yapın.' : 'Please log in to use cloud render.');
      return;
    }

    try {
      setStatus('uploading');
      setProgress(5);
      setErrorMsg('');

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
      setProgress(15);
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

      // Security Rules Match: uid == request.auth.uid and status == 'pending'
      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        status: 'pending',
        tool_type: type,
        params: params,
        created_at: serverTimestamp()
      });

      // Ping worker to immediately process queue without waiting
      fetch(`${apiUrl}/jobs/ping`).catch(() => {});

      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.status === 'processing') {
          setProgress((prev) => Math.max(prev, 40));
        }

        if (data.status === 'completed') {
          const finalUrl = data.result_url?.startsWith('http')
            ? data.result_url
            : `${apiUrl}${data.result_url}`;
          setResultUrl(finalUrl);
          setStatus('completed');
          unsubscribe();
        } else if (data.status === 'failed') {
          setErrorMsg(data.error_message || data.error || 'Server render failed.');
          setStatus('error');
          unsubscribe();
        }
      }, (err) => {
        console.error("Snapshot error:", err);
        setErrorMsg(err.message || 'Error tracking render job.');
        setStatus('error');
      });
    } catch (err) {
      console.error("Cloud processing error:", err);
      setErrorMsg(err.message || 'Failed to submit cloud render job.');
      setStatus('error');
    }
  };

  const isServerTool = type === 'echo';

  return (
    <div className="w-full flex-grow flex flex-col h-full">
      <Helmet>
        <title>{`${toolInfo.title1} ${toolInfo.title2} — Free Online Video Effect Maker | AnimationMaker`}</title>
        <meta name="description" content={`${toolInfo.desc} Create professional ${toolInfo.title1} ${toolInfo.title2} video animations online in seconds directly in your browser.`} />
        <meta name="keywords" content={`${toolInfo.title1} ${toolInfo.title2}, ${type} video effect, online video animator, free video effect maker, kinetic video effects, animationmaker`} />
        <link rel="canonical" href={`https://animationmaker.m0s.space/effects/${type}`} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content={`${toolInfo.title1} ${toolInfo.title2} | AnimationMaker`} />
        <meta property="og:description" content={toolInfo.desc} />
        <meta property="og:url" content={`https://animationmaker.m0s.space/effects/${type}`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${toolInfo.title1} ${toolInfo.title2} | AnimationMaker`} />
        <meta name="twitter:description" content={toolInfo.desc} />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/logo.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": `${toolInfo.title1} ${toolInfo.title2}`,
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "description": toolInfo.desc,
            "url": `https://animationmaker.m0s.space/effects/${type}`,
            "publisher": {
              "@type": "Organization",
              "name": "AnimationMaker",
              "url": "https://animationmaker.m0s.space"
            }
          })}
        </script>
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10 h-full min-h-0"
      >
        {/* Header matching MatchCutTool */}
        <header className="mb-6 flex-shrink-0 flex justify-between items-start">
          <div>
            <AnimatePresence mode="wait">
              {isEditingName ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    placeholder={lang === 'tr' ? "Proje İsmi..." : "Project Name..."}
                    className="bg-zinc-900 border border-zinc-700 focus:border-accent-gold text-white text-xl sm:text-2xl font-bold px-3 py-1 rounded-lg outline-none w-full max-w-[300px]"
                    autoFocus
                  />
                  <button onClick={() => setIsEditingName(false)} className="p-2 bg-accent-gold text-black rounded-lg hover:bg-yellow-400">
                    <Check size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 mb-2 group cursor-pointer w-fit"
                  onClick={() => setIsEditingName(true)}
                >
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                    {projectName || (
                      <span>{toolInfo.title1} <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">{toolInfo.title2}</span></span>
                    )}
                  </h2>
                  {user && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                      <Edit2 size={16} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
              {toolInfo.desc}
            </p>
          </div>

          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 text-xs font-mono bg-zinc-900/90 px-3 py-1.5 rounded-full text-zinc-300 border border-zinc-700 shadow-lg absolute top-4 right-4 sm:relative sm:top-0 sm:right-0"
            >
              <span className={`w-2 h-2 rounded-full ${saveStatus.includes('...') || saveStatus === 'Saving...' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
              {saveStatus}
            </motion.div>
          )}
        </header>

        {/* Main Workspace (Left: Settings, Right: Preview) */}
        <main className="flex flex-col lg:flex-row gap-6 lg:gap-6 flex-1 min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          
          {/* LEFT COLUMN: Settings Panel (Matching SettingsPanel.jsx) */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col h-auto lg:h-full lg:overflow-hidden gap-4">
            <div className="flex-1 lg:overflow-y-auto lg:pr-2 lg:custom-scrollbar">
              <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 p-4 md:p-6 rounded-lg h-full shadow-lg flex flex-col">
                <h2 className="text-xl font-bold text-white flex-shrink-0">{t('customize', lang) || 'ÖZELLEŞTİR'}</h2>

                <div className="flex-grow space-y-5 border-t border-zinc-700 mt-4 pt-4 overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* Video Duration (Max 5 Min) */}
                  <div>
                    <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                      <span>{lang === 'tr' ? 'Video Süresi (Max 5 Dk)' : 'Video Duration (Max 5 Min)'}</span>
                      <span className="text-yellow-400 font-mono font-bold">{formatDuration(duration)}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="300"
                      step="1"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[5, 15, 30, 60, 180, 300].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDuration(s)}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                            duration === s
                              ? 'bg-accent text-white'
                              : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                          }`}
                        >
                          {s >= 60 ? `${s / 60}m` : `${s}s`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (fileDuration && !isNaN(fileDuration)) {
                            const fullSec = Math.min(300, Math.max(3, Math.round(fileDuration)));
                            setDuration(fullSec);
                          } else {
                            setDuration(300);
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                          duration === (fileDuration ? Math.min(300, Math.max(3, Math.round(fileDuration))) : 300)
                            ? 'bg-accent text-white'
                            : 'bg-zinc-800 text-yellow-400 hover:bg-zinc-700'
                        }`}
                        title={fileDuration ? (lang === 'tr' ? `Tam Video Süresi (${Math.round(fileDuration)}s)` : `Full Video Duration (${Math.round(fileDuration)}s)`) : 'Max 5m (300s)'}
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* 1. KEN BURNS CONTROLS */}
                  {type === 'ken-burns' && (
                    <>
                      <SegmentedControl
                        label={lang === 'tr' ? 'Yakınlaştırma Yönü' : 'Zoom Direction'}
                        options={[
                          { value: 'in', label: lang === 'tr' ? 'Yakınlaş' : 'Zoom In' },
                          { value: 'out', label: lang === 'tr' ? 'Uzaklaş' : 'Zoom Out' }
                        ]}
                        value={zoomDirection}
                        onChange={setZoomDirection}
                      />

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {lang === 'tr' ? 'Kamera Kaydırma (Pan)' : 'Camera Pan Style'}
                        </label>
                        <select
                          value={panStyle}
                          onChange={(e) => setPanStyle(e.target.value)}
                          className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm outline-none"
                        >
                          <option value="center">{lang === 'tr' ? 'Merkez (Sabit)' : 'Center (No Pan)'}</option>
                          <option value="left_to_right">{lang === 'tr' ? 'Soldan Sağa' : 'Left to Right'}</option>
                          <option value="right_to_left">{lang === 'tr' ? 'Sağdan Sola' : 'Right to Left'}</option>
                          <option value="top_to_bottom">{lang === 'tr' ? 'Yukarıdan Aşağıya' : 'Top to Bottom'}</option>
                          <option value="bottom_to_top">{lang === 'tr' ? 'Aşağıdan Yukarıya' : 'Bottom to Top'}</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Yakınlaştırma Hızı' : 'Zoom Rate'}</span>
                          <span className="text-yellow-400 font-mono">{zoomRate}</span>
                        </div>
                        <input
                          type="range"
                          min="0.01"
                          max="0.10"
                          step="0.01"
                          value={zoomRate}
                          onChange={(e) => setZoomRate(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 2. VHS TAPE CONTROLS */}
                  {type === 'vhs-tape' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Renk Ayrışımı (Aberration)' : 'Chromatic Aberration'}</span>
                          <span className="text-yellow-400 font-mono">{aberrationStrength}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.1"
                          value={aberrationStrength}
                          onChange={(e) => setAberrationStrength(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <SegmentedControl
                        label={lang === 'tr' ? 'Manyetik Kaset Gürültüsü' : 'Tracking Noise'}
                        options={[
                          { value: 'low', label: t('low', lang) || 'Az' },
                          { value: 'medium', label: t('medium', lang) || 'Orta' },
                          { value: 'high', label: t('high', lang) || 'Yüksek' }
                        ]}
                        value={trackingNoise}
                        onChange={setTrackingNoise}
                      />

                      <Switch
                        label={lang === 'tr' ? 'CRT Tarama Titremesi' : 'Scanline Flicker'}
                        checked={scanlineFlicker}
                        onChange={(e) => setScanlineFlicker(e.target.checked)}
                      />

                      <Switch
                        label={lang === 'tr' ? 'VCR Tarih/Saat Damgası' : 'VCR Timestamp OSD'}
                        checked={vhsTimestamp}
                        onChange={(e) => setVhsTimestamp(e.target.checked)}
                      />
                    </>
                  )}

                  {/* 3. GLITCH MASTER CONTROLS */}
                  {type === 'glitch-master' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Glitch Şiddeti' : 'Glitch Intensity'}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(glitchIntensity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={glitchIntensity}
                          onChange={(e) => setGlitchIntensity(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>RGB Shift Offset</span>
                          <span className="text-yellow-400 font-mono">{rgbShift}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="40"
                          step="1"
                          value={rgbShift}
                          onChange={(e) => setRgbShift(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Dilimleme Sıklığı' : 'Slice Rate'}</span>
                          <span className="text-yellow-400 font-mono">{sliceRate}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="1"
                          value={sliceRate}
                          onChange={(e) => setSliceRate(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 4. TYPEWRITER CONTROLS */}
                  {type === 'typewriter' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {lang === 'tr' ? 'Metin İçeriği' : 'Story Content'}
                        </label>
                        <textarea
                          rows="4"
                          value={typewriterText}
                          onChange={(e) => setTypewriterText(e.target.value)}
                          className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm resize-none"
                        />
                      </div>

                      <SegmentedControl
                        label={lang === 'tr' ? 'İmleç Stili' : 'Cursor Style'}
                        options={[
                          { value: 'block', label: '█ Block' },
                          { value: 'line', label: '| Line' },
                          { value: 'underscore', label: '_ Under' }
                        ]}
                        value={cursorStyle}
                        onChange={setCursorStyle}
                      />

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Yazım Hızı' : 'Typing Speed'}</span>
                          <span className="text-yellow-400 font-mono">{typingSpeed} cps</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="40"
                          step="1"
                          value={typingSpeed}
                          onChange={(e) => setTypingSpeed(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 5. SCANLINE CRT CONTROLS */}
                  {type === 'scanline' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Çizgi Sıklığı' : 'Scanline Density'}</span>
                          <span className="text-yellow-400 font-mono">{scanlineDensity}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="12"
                          step="1"
                          value={scanlineDensity}
                          onChange={(e) => setScanlineDensity(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Fosfor Parıltısı' : 'Phosphor Glow'}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(phosphorGlow * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={phosphorGlow}
                          onChange={(e) => setPhosphorGlow(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 6. ASCII MATRIX CONTROLS */}
                  {type === 'ascii' && (
                    <>
                      <SegmentedControl
                        label={lang === 'tr' ? 'Renk Teması' : 'Color Palette'}
                        options={[
                          { value: 'matrixGreen', label: 'Matrix' },
                          { value: 'cyberNeon', label: 'Cyber' },
                          { value: 'retroAmber', label: 'Amber' },
                          { value: 'trueColor', label: 'Real' }
                        ]}
                        value={asciiTheme}
                        onChange={setAsciiTheme}
                      />

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Karakter Çözünürlüğü' : 'Character Grid Size'}</span>
                          <span className="text-yellow-400 font-mono">{asciiResolution}px</span>
                        </div>
                        <input
                          type="range"
                          min="6"
                          max="20"
                          step="1"
                          value={asciiResolution}
                          onChange={(e) => setAsciiResolution(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 7. ECHO MOTION CONTROLS */}
                  {type === 'echo' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'Yankı Katman Sayısı' : 'Echo Ghost Layers'}</span>
                          <span className="text-yellow-400 font-mono">{echoCount}</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={echoCount}
                          onChange={(e) => setEchoCount(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{lang === 'tr' ? 'İz Sönümleme Oranı' : 'Motion Trail Decay'}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(echoDecay * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="0.95"
                          step="0.05"
                          value={echoDecay}
                          onChange={(e) => setEchoDecay(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Thematic Audio FX Switch (VHS, Scanline, Glitch) */}
                  {['vhs-tape', 'scanline', 'glitch-master'].includes(type) && (
                    <Switch
                      label={lang === 'tr' ? 'Tematik Ses Efekti (DSP)' : 'Thematic Audio FX (DSP)'}
                      checked={audioFxEnabled}
                      onChange={(e) => setAudioFxEnabled(e.target.checked)}
                    />
                  )}

                  {/* 1080p High Quality Switch */}
                  <Switch
                    label={t('highQualityLabel', lang) || 'Yüksek Kalite (1080p)'}
                    checked={hdOutput}
                    onChange={(e) => setHdOutput(e.target.checked)}
                  />

                </div>

                {/* Video Format (Aspect Ratio) matching MatchCutTool */}
                <div className="border-t border-zinc-700 pt-4 flex-shrink-0">
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('formatLabel', lang) || 'Video Formatı'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['16:9', '9:16', '1:1'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormatPreset(fmt)}
                        className={`p-2 rounded-md font-semibold transition-colors ${
                          formatPreset === fmt
                            ? 'bg-accent text-white ring-2 ring-offset-2 ring-offset-zinc-900 ring-accent'
                            : 'bg-zinc-700 hover:bg-zinc-600'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Action Button matching MatchCutTool */}
                <button
                  type="button"
                  onClick={!isServerTool ? startDeviceRender : startCloudProcessing}
                  disabled={status === 'processing' || status === 'uploading'}
                  className="w-full bg-[#F5B301] text-black font-extrabold py-3.5 px-4 rounded-lg hover:bg-yellow-400 hover:text-black transition-all shadow-lg shadow-yellow-500/20 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed mt-4 flex-shrink-0 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
                >
                  {status === 'processing' || status === 'uploading' ? (
                    <>
                      <RotateCcw className="animate-spin" size={18} />
                      <span>{t('generatingButton', lang) || 'Oluşturuluyor...'}</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" />
                      <span>{t('generateButton', lang) || 'Videoyu Oluştur'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Video Preview Area (Matching Preview.jsx) */}
          <div className="flex-1 flex flex-col h-auto lg:h-full min-h-[400px] lg:min-h-0">
            <div className="w-full h-full bg-zinc-900/50 backdrop-blur-sm border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 relative overflow-hidden">
              
              {/* Generating / Processing State */}
              {(status === 'processing' || status === 'uploading') && (
                <div className="w-full max-w-md text-center">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    {status === 'uploading' ? (lang === 'tr' ? 'Buluta Yükleniyor...' : 'Uploading...') : (t('generatingTitle', lang) || 'Video Oluşturuluyor...')}
                  </h3>
                  <div className="w-full bg-zinc-800 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-zinc-400 to-zinc-600 h-2.5 rounded-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-400 mt-2 font-mono">{Math.round(progress)}%</p>
                </div>
              )}

              {/* Completed Video State */}
              {status === 'completed' && resultUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <div className={`w-full h-[calc(100%-60px)] flex items-center justify-center ${formatPreset === '9:16' ? 'max-w-xs' : ''}`}>
                    <video controls autoPlay loop src={resultUrl} className="max-w-full max-h-full object-contain rounded-md shadow-2xl" />
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={resultUrl}
                      download={`${type}_${Date.now()}.mp4`}
                      className="flex-shrink-0 bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all flex items-center gap-2"
                    >
                      <Download size={16} />
                      {t('downloadButton', lang) || 'İndir (MP4)'}
                    </a>
                    <button
                      onClick={() => { setResultUrl(''); setStatus('idle'); }}
                      className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg transition-colors text-sm"
                    >
                      {lang === 'tr' ? 'Yeniden Düzenle' : 'Edit Again'}
                    </button>
                  </div>
                </div>
              )}

              {/* Idle / Live Canvas Preview State */}
              {status !== 'completed' && status !== 'processing' && status !== 'uploading' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className={`w-full flex-1 flex items-center justify-center min-h-0 ${
                    formatPreset === '9:16' ? 'max-w-xs' : (formatPreset === '1:1' ? 'max-w-md' : 'w-full')
                  }`}>
                    <canvas
                      ref={canvasRef}
                      width={formatPreset === '9:16' ? 360 : 640}
                      height={formatPreset === '9:16' ? 640 : (formatPreset === '1:1' ? 640 : 360)}
                      className="max-h-full max-w-full object-contain rounded-md shadow-2xl"
                    />
                  </div>

                  {/* Media Uploader Controls (docked at preview bottom) */}
                  {type !== 'typewriter' && (
                    <div className="w-full max-w-md mt-4 flex flex-col items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-md text-sm font-semibold transition-colors text-zinc-200 flex items-center justify-center gap-2 truncate shadow"
                      >
                        <Upload size={16} />
                        {file ? file.name : (lang === 'tr' ? 'Medyayı Değiştir (Görsel/Video)' : 'Upload Media (Photo/Video)')}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={type === 'ken-burns' ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,image/jpeg,image/png,image/webp"}
                        className="hidden"
                      />
                      {file && file.type.startsWith('video/') && (
                        <div className="flex items-center justify-between w-full text-xs font-mono text-emerald-400 px-1 mt-0.5">
                          <span className="flex items-center gap-1.5">
                            <Volume2 size={13} />
                            {lang === 'tr' ? 'Orijinal Ses Korunuyor' : 'Original Audio Included'}
                          </span>
                          {fileDuration && (
                            <span className="text-zinc-400">
                              {lang === 'tr' ? 'Video:' : 'Source:'} {formatDuration(Math.round(fileDuration))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="mt-3 w-full max-w-md bg-red-950/40 border border-red-500/40 p-2.5 rounded-lg text-red-400 text-xs font-medium text-center">
                      {errorMsg}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </main>
      </motion.div>
    </div>
  );
}
