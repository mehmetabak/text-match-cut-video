import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Zap, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

// 4 Distinct Aesthetic Scenes for Match Cut Transitions
const SCENES = [
  {
    id: 'newspaper',
    name: 'Vintage Newsprint',
    nameTr: 'Vintage Gazete',
    bg: '#F5F0E6',
    textColor: '#1A1816',
    secondaryText: '#78716C',
    highlightBg: '#F5B301',
    highlightText: '#16161A',
    font: 'serif',
    topHeader: 'THE DAILY CHRONICLE • VOL. 94',
    subText: 'CLASSIFIED ARCHIVES DISCLOSED TO THE PUBLIC RECORD',
    hasVignette: true,
    grain: 0.15
  },
  {
    id: 'cyber',
    name: 'Cyberpunk Neon',
    nameTr: 'Siberpunk Glitch',
    bg: '#0A0A10',
    textColor: '#E2E8F0',
    secondaryText: '#64748B',
    highlightBg: '#00E5FF',
    highlightText: '#0A0A10',
    font: 'mono',
    topHeader: 'SYS_OVERRIDE // SECTOR 09',
    subText: 'HIGH-FREQUENCY KINETIC BUFFER STREAM LOCKED',
    hasVignette: true,
    grain: 0.25
  },
  {
    id: 'noir',
    name: 'Dark Dossier',
    nameTr: 'Gizli Dosya (Noir)',
    bg: '#141418',
    textColor: '#F8FAFC',
    secondaryText: '#64748B',
    highlightBg: '#E11D48',
    highlightText: '#FFFFFF',
    font: 'serif',
    topHeader: 'CONFIDENTIAL DOSSIER • FILE #892',
    subText: 'EVIDENCE EXCERPTS CONFIRMED FOR IMMEDIATE BROADCAST',
    hasVignette: true,
    grain: 0.2
  },
  {
    id: 'minimal',
    name: 'Modern Gold',
    nameTr: 'Modern Altın',
    bg: '#0F0F12',
    textColor: '#FFFFFF',
    secondaryText: '#94A3B8',
    highlightBg: '#F5B301',
    highlightText: '#0F0F12',
    font: 'sans',
    topHeader: 'ANIMATIONMAKER STUDIO PRO',
    subText: 'BROWSER-POWERED INSTANT VIDEO EFFECT PIPELINE',
    hasVignette: true,
    grain: 0.1
  }
];

export default function HeroMatchCutVisualizer({ targetWord = "MATCH CUT" }) {
  const { lang } = useSettingsStore();
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTurbo, setIsTurbo] = useState(false);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const animFrameRef = useRef(null);
  const lastSwitchTimeRef = useRef(0);
  const shakeRef = useRef({ x: 0, y: 0 });

  // Switch interval: normal ~240ms, turbo ~110ms
  const switchInterval = isTurbo ? 110 : 240;

  useEffect(() => {
    let active = true;

    const render = (time) => {
      if (!active) return;

      const canvas = canvasRef.current;
      if (canvas && isPlaying) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Check if it's time to cut to the next scene
        if (time - lastSwitchTimeRef.current > switchInterval) {
          lastSwitchTimeRef.current = time;
          setCurrentSceneIdx((prev) => (prev + 1) % SCENES.length);
          // Micro camera shake on cut
          shakeRef.current = {
            x: (Math.random() - 0.5) * 6,
            y: (Math.random() - 0.5) * 6
          };
        } else {
          // Damping shake
          shakeRef.current.x *= 0.82;
          shakeRef.current.y *= 0.82;
        }

        const scene = SCENES[currentSceneIdx];

        ctx.save();
        ctx.translate(shakeRef.current.x, shakeRef.current.y);

        // 1. Background Fill
        ctx.fillStyle = scene.bg;
        ctx.fillRect(-10, -10, width + 20, height + 20);

        // 2. Subtle Background Grid/Lines
        ctx.strokeStyle = scene.id === 'newspaper' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let y = 30; y < height; y += 36) {
          ctx.beginPath();
          ctx.moveTo(20, y);
          ctx.lineTo(width - 20, y);
          ctx.stroke();
        }

        // 3. Header Stamp / File Info
        ctx.fillStyle = scene.secondaryText;
        ctx.font = scene.font === 'mono' ? 'bold 11px "JetBrains Mono", monospace' : '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(scene.topHeader, width / 2, 45);

        // 4. Background Body Paragraph Lines (Simulated Text)
        ctx.fillStyle = scene.secondaryText;
        ctx.font = scene.font === 'serif' ? 'italic 13px Georgia, serif' : '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Dynamic typography transitions synchronized across multi-layer frames", width / 2, height / 2 - 58);
        ctx.fillText(scene.subText, width / 2, height / 2 + 68);

        // 5. Centered Key Word Focus Box (Match Cut Hero Highlight)
        const wordText = targetWord.toUpperCase();
        let fontSize = 38;
        let fontFamily = 'Inter, sans-serif';
        if (scene.font === 'mono') fontFamily = '"JetBrains Mono", monospace';
        else if (scene.font === 'serif') fontFamily = '"Times New Roman", Georgia, serif';

        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        const textMetrics = ctx.measureText(wordText);
        const textW = textMetrics.width;
        const padX = 22;
        const padY = 12;
        const boxX = (width - textW) / 2 - padX;
        const boxY = height / 2 - (fontSize / 2) - padY;
        const boxW = textW + (padX * 2);
        const boxH = fontSize + (padY * 2);

        // Highlight Box with shadow
        ctx.shadowColor = scene.highlightBg;
        ctx.shadowBlur = scene.id === 'cyber' ? 18 : 6;
        ctx.fillStyle = scene.highlightBg;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.shadowBlur = 0;

        // Highlight Box Border
        ctx.strokeStyle = scene.textColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Word Render in Center
        ctx.fillStyle = scene.highlightText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wordText, width / 2, height / 2 + 2);

        // 6. Corner Film Camera Markers
        const markerLen = 14;
        ctx.strokeStyle = scene.id === 'newspaper' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(25, 25 + markerLen); ctx.lineTo(25, 25); ctx.lineTo(25 + markerLen, 25);
        ctx.stroke();
        // Top-Right
        ctx.beginPath();
        ctx.moveTo(width - 25 - markerLen, 25); ctx.lineTo(width - 25, 25); ctx.lineTo(width - 25, 25 + markerLen);
        ctx.stroke();
        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(25, height - 25 - markerLen); ctx.lineTo(25, height - 25); ctx.lineTo(25 + markerLen, height - 25);
        ctx.stroke();
        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(width - 25 - markerLen, height - 25); ctx.lineTo(width - 25, height - 25); ctx.lineTo(width - 25, height - 25 - markerLen);
        ctx.stroke();

        // 7. Vignette
        const vigGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.35, width / 2, height / 2, width * 0.7);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, scene.id === 'newspaper' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(-10, -10, width + 20, height + 20);

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isTurbo, currentSceneIdx, targetWord, switchInterval]);

  const activeScene = SCENES[currentSceneIdx];

  return (
    <div className="relative w-full max-w-[680px] mx-auto group select-none">
      {/* Outer Glow in signature Gold */}
      <div className="absolute -inset-1 bg-gradient-to-r from-accent-gold/20 via-amber-500/10 to-accent-gold/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-90 transition-opacity duration-500 pointer-events-none" />

      {/* Main Container */}
      <div 
        className="relative bg-[#16161A] border border-[#2A2A30] group-hover:border-accent-gold/40 rounded-2xl p-3 sm:p-4 shadow-2xl transition-all duration-300 backdrop-blur-md"
        onMouseEnter={() => setIsTurbo(true)}
        onMouseLeave={() => setIsTurbo(false)}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-2 pb-2.5 mb-1.5 border-b border-border-color text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-gold"></span>
            </span>
            <span className="font-mono font-bold text-white tracking-wider text-[11px] uppercase">
              {t('liveMatchCutSim', lang)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-muted bg-surface-raised px-2 py-0.5 rounded border border-border-color hidden sm:inline-block">
              {lang === 'tr' ? activeScene.nameTr : activeScene.name}
            </span>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 rounded bg-surface-raised hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div className="relative rounded-xl overflow-hidden bg-[#0B0B0D] aspect-[16/9] w-full flex items-center justify-center border border-zinc-800 shadow-inner">
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover block"
          />

          {/* Interactive Hover Badge */}
          <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 pointer-events-none">
            {isTurbo ? (
              <>
                <Zap size={11} className="text-accent-gold animate-bounce" />
                <span className="text-accent-gold font-bold">{t('turboCutActive', lang)}</span>
              </>
            ) : (
              <>
                <Sparkles size={11} className="text-zinc-400" />
                <span>{t('hoverSpeedUp', lang)}</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom Interactive Feature Badges */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2 text-center text-[11px] font-mono text-text-muted">
          <div className="bg-surface-raised/70 border border-border-color/60 rounded-lg py-1 px-2 flex items-center justify-center gap-1">
            <span className="text-accent-gold font-bold">120ms</span> {t('cutSpeed', lang)}
          </div>
          <div className="bg-surface-raised/70 border border-border-color/60 rounded-lg py-1 px-2 flex items-center justify-center gap-1">
            <span className="text-accent-gold font-bold">60 FPS</span> WASM Engine
          </div>
          <div className="bg-surface-raised/70 border border-border-color/60 rounded-lg py-1 px-2 flex items-center justify-center gap-1">
            <span className="text-accent-gold font-bold">100%</span> {t('freeOutput', lang)}
          </div>
        </div>
      </div>
    </div>
  );
}
