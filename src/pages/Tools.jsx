import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Helmet } from 'react-helmet-async';

// Component dışına taşındı: artık her render'da yeniden oluşturulmuyor
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
};

// Tool tanımları da component dışına taşındı — sabit veri, her seferinde yeniden kurulmasına gerek yok
const TOOLS = [
  {
    id: 'text-match-cut',
    titleKey: 'tool_text_title',
    descKey: 'tool_text_desc',
    path: '/match-cut',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-zinc-800 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center p-6 opacity-90">
        <div className="text-[9px] font-mono text-[#F5B301] font-bold tracking-widest uppercase mb-1">
          KINETIC TYPOGRAPHY
        </div>
        <div className="relative flex items-center justify-center px-4 py-2 bg-zinc-900/90 border border-yellow-500/50 rounded-lg shadow-xl overflow-hidden">
          {isHovered ? (
            <motion.div
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.06, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase font-serif"
            >
              MATCH <span className="text-[#F5B301] shadow-[0_0_12px_#F5B301]">CUT</span>
            </motion.div>
          ) : (
            <div className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase font-serif">
              MATCH <span className="text-[#F5B301]">CUT</span>
            </div>
          )}
          {isHovered && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
            />
          )}
        </div>
        <div className="flex gap-1.5 mt-2 opacity-50">
          <div className="h-1 w-12 bg-[#F5B301] rounded-full" />
          <div className="h-1 w-8 bg-zinc-600 rounded-full" />
          <div className="h-1 w-14 bg-zinc-700 rounded-full" />
        </div>
      </div>
    )
  },
  {
    id: 'spotlight',
    titleKey: 'tool_spotlight_title',
    descKey: 'tool_spotlight_desc',
    path: '/effects/spotlight',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-amber-600/30 via-yellow-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col justify-center px-6 opacity-85">
        <div className="w-16 h-3.5 bg-amber-500/20 rounded text-[8px] text-amber-300 font-bold px-1.5 mb-2 flex items-center">
          NATURE
        </div>
        <div className="space-y-1.5 font-serif text-[11px] text-zinc-300">
          <div>Quantum coherence discovered in room temperature...</div>
          <div className="relative inline-block">
            <span className="relative z-10 font-bold text-white">ambient conditions sustained</span>
            {isHovered ? (
              <motion.div
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 bg-yellow-400/50 rounded h-full -z-0"
              />
            ) : (
              <div className="absolute inset-0 bg-yellow-400/50 rounded h-full -z-0 w-[85%]" />
            )}
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'formula',
    titleKey: 'tool_formula_title',
    descKey: 'tool_formula_desc',
    path: '/effects/formula',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-cyan-600/30 via-blue-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center p-4 opacity-85">
        <div className="text-[9px] font-mono text-cyan-400/80 mb-1 tracking-widest uppercase">
          EULER'S THEOREM
        </div>
        <div className="font-serif text-lg font-bold text-white tracking-wider flex items-center gap-1">
          <span>e</span>
          <sup className="text-xs text-cyan-300">iπ</sup>
          <span className="text-zinc-400">+</span>
          <span>1</span>
          <span className="text-zinc-400">=</span>
          {isHovered ? (
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.15, 1], textShadow: ['0 0 8px #38BDF8', '0 0 20px #38BDF8', '0 0 8px #38BDF8'] }}
              transition={{ duration: 1.0, repeat: Infinity }}
              className="text-cyan-300"
            >
              0
            </motion.span>
          ) : (
            <span className="text-cyan-300">0</span>
          )}
        </div>
        <div className="text-[9px] font-sans text-zinc-400 mt-1 italic">
          3Blue1Brown LaTeX equation
        </div>
      </div>
    )
  },
  {
    id: 'timeline',
    titleKey: 'tool_timeline_title',
    descKey: 'tool_timeline_desc',
    path: '/effects/timeline',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-amber-600/30 via-yellow-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col justify-center px-5 opacity-85">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] font-mono text-amber-400 font-bold tracking-wider">CHRONICLES</div>
          <div className="text-[8px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">1969 → 2024</div>
        </div>
        <div className="relative flex items-center w-full py-2">
          {/* Axis Track */}
          <div className="w-full h-0.5 bg-zinc-700 relative">
            {isHovered ? (
              <motion.div
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full bg-amber-400 shadow-[0_0_8px_#F59E0B]"
              />
            ) : (
              <div className="h-full w-[65%] bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
            )}
          </div>
          {/* Active Node Pin */}
          <div className={`absolute left-[60%] -top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-zinc-900 ${isHovered ? 'shadow-[0_0_14px_#F59E0B] scale-110' : 'shadow-[0_0_6px_#F59E0B]'} transition-all`} />
        </div>
        <div className="flex justify-between items-center text-[10px] text-zinc-300 font-semibold mt-1">
          <span>Apollo 11</span>
          <span className="text-amber-400 font-mono">AI Age</span>
        </div>
      </div>
    )
  },
  {
    id: 'tree',
    titleKey: 'tool_tree_title',
    descKey: 'tool_tree_desc',
    path: '/effects/tree',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-yellow-600/30 via-amber-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-between px-5 opacity-85">
        {/* Root Card */}
        <div className="w-20 p-1.5 bg-zinc-800/90 border border-yellow-500/50 rounded flex flex-col justify-center shadow-lg">
          <div className="text-[7px] text-yellow-400 font-mono font-bold">ROOT EVENT</div>
          <div className="text-[9px] text-white font-bold truncate">Revolution</div>
        </div>
        {/* Connecting Lines */}
        <div className="flex-1 flex flex-col justify-center gap-2 px-1 relative">
          <div className="h-0.5 w-full bg-yellow-500/40 relative overflow-hidden">
            {isHovered && (
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-full w-1/2 bg-yellow-300 shadow-[0_0_8px_#F5B301]"
              />
            )}
          </div>
          <div className="h-0.5 w-full bg-yellow-500/40 relative overflow-hidden">
            {isHovered && (
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.3 }}
                className="h-full w-1/2 bg-yellow-300 shadow-[0_0_8px_#F5B301]"
              />
            )}
          </div>
        </div>
        {/* Branch Cards */}
        <div className="flex flex-col gap-1.5">
          <motion.div
            animate={isHovered ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 1.2, repeat: isHovered ? Infinity : 0 }}
            className="w-24 p-1 bg-zinc-800/90 border border-yellow-500/40 rounded flex items-center justify-between shadow"
          >
            <span className="text-[8px] text-zinc-200 truncate">Automation</span>
            <span className="text-[7px] bg-yellow-500 text-black font-bold px-1 rounded">85%</span>
          </motion.div>
          <motion.div
            animate={isHovered ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 1.2, repeat: isHovered ? Infinity : 0, delay: 0.4 }}
            className="w-24 p-1 bg-zinc-800/90 border border-yellow-500/40 rounded flex items-center justify-between shadow"
          >
            <span className="text-[8px] text-zinc-200 truncate">Urban Shift</span>
            <span className="text-[7px] bg-yellow-500 text-black font-bold px-1 rounded">+340%</span>
          </motion.div>
        </div>
      </div>
    )
  },
  {
    id: 'counter',
    titleKey: 'tool_counter_title',
    descKey: 'tool_counter_desc',
    path: '/effects/counter',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-emerald-600/30 via-teal-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col justify-center px-6 opacity-85">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-wider">CAPACITY (GW)</span>
          <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-bold px-1 rounded">+394% ↗</span>
        </div>
        <div className="font-sans text-xl font-black text-white tracking-tight flex items-baseline gap-1">
          {isHovered ? (
            <motion.span
              animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.03, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-emerald-400 shadow-[0_0_12px_#10B981]"
            >
              4,200
            </motion.span>
          ) : (
            <span className="text-emerald-400">4,200</span>
          )}
          <span className="text-xs text-zinc-400 font-medium">GW</span>
        </div>
        {/* Dual Progress Gauges */}
        <div className="space-y-1 mt-1.5">
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            {isHovered ? (
              <motion.div
                animate={{ width: ['20%', '85%', '20%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full bg-emerald-400 shadow-[0_0_6px_#10B981]"
              />
            ) : (
              <div className="h-full w-[85%] bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            )}
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-[35%] h-full bg-zinc-600" />
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'gsearch',
    titleKey: 'tool_gsearch_title',
    descKey: 'tool_gsearch_desc',
    path: '/effects/gsearch',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-blue-600/30 via-red-600/10 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 opacity-85 overflow-hidden">
        <div className="flex font-semibold text-lg mb-2 tracking-normal items-center justify-center select-none">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]">o</span>
          <span className="text-[#FBBC05]">o</span>
          <span className="text-[#4285F4]">g</span>
          <span className="text-[#34A853]">l</span>
          <span className="text-[#EA4335]">e</span>
        </div>
        <div className="w-full max-w-[200px] h-7 bg-zinc-800/90 border border-zinc-600/60 rounded-full flex items-center px-2.5 gap-1.5 shadow-inner">
          <span className="text-xs text-zinc-400">🔍</span>
          {isHovered ? (
            <motion.span
              animate={{ width: ['0%', '100%', '100%', '0%'] }}
              transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.55, 0.85, 1], ease: 'linear' }}
              className="text-[11px] font-medium text-white truncate whitespace-nowrap overflow-hidden inline-block"
            >
              viral video maker...
            </motion.span>
          ) : (
            <span className="text-[11px] font-medium text-zinc-400 truncate">
              viral video maker...
            </span>
          )}
        </div>
      </div>
    )
  },
  {
    id: 'paper',
    titleKey: 'tool_paper_title',
    descKey: 'tool_paper_desc',
    path: '/effects/paper',
    isPro: false,
    isSoon: false,
    isFree: true,
    bgClass: 'from-amber-700/30 via-stone-800 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center p-4 opacity-90">
        {/* Ripped Paper Collage Card */}
        <motion.div
          animate={isHovered ? { rotate: [-1, 1.5, -1], y: [0, -2, 0] } : { rotate: -1, y: 0 }}
          transition={{ duration: 0.8, repeat: isHovered ? Infinity : 0, ease: "easeInOut" }}
          className="relative w-44 bg-[#F2EFE9] text-zinc-900 p-2.5 rounded shadow-2xl border border-stone-300"
          style={{ transformOrigin: 'top center' }}
        >
          {/* Washi Tape Strip */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-amber-400/80 -rotate-2 shadow-sm border border-amber-500/40 rounded-sm" />
          
          <div className="flex items-center justify-between text-[7px] font-mono font-bold text-stone-500 border-b border-stone-300 pb-1 mb-1">
            <span>ARCHIVES #741</span>
            <span className="bg-red-600 text-white px-1 rounded-xs">TOP SECRET</span>
          </div>

          <div className="font-serif text-[10px] font-black leading-tight text-zinc-900 mb-1">
            CLASSIFIED DOSSIER
          </div>

          <div className="text-[8px] font-serif text-zinc-700 leading-snug">
            Strategic operations &{' '}
            <span className="relative inline-block px-0.5">
              <span className="relative z-10 font-bold text-black">undisclosed logs</span>
              {isHovered ? (
                <motion.span
                  animate={{ width: ['0%', '100%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.4 }}
                  className="absolute inset-0 bg-yellow-300/80 -z-0 h-full rounded-xs"
                />
              ) : (
                <span className="absolute inset-0 bg-yellow-300/80 -z-0 h-full rounded-xs w-full" />
              )}
            </span>
          </div>
        </motion.div>
      </div>
    )
  },
  {
    id: 'ken-burns',
    titleKey: 'toolKenBurns',
    descKey: 'toolKenBurnsDesc',
    path: '/effects/ken-burns',
    isPro: true,
    isSoon: false,
    bgClass: 'from-[#00E5FF]/20 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-full h-full border border-[#00E5FF]/30 m-4 rounded-lg"
          />
        ) : (
          <div className="w-full h-full border border-[#00E5FF]/30 m-4 rounded-lg" />
        )}
      </div>
    )
  },
  {
    id: 'tracking',
    titleKey: 'tool_tracking_title',
    descKey: 'tool_tracking_desc',
    path: '/effects/tracking',
    isPro: true,
    isSoon: false,
    bgClass: 'from-cyan-900/40 via-blue-900/20 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center p-4 opacity-90">
        {/* Reticle Lock Box */}
        <div className="relative w-36 h-28 border border-cyan-500/30 bg-cyan-950/20 rounded flex flex-col justify-between p-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          {/* Corner Brackets */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          {/* Radar Scanning Line */}
          {isHovered && (
            <motion.div
              animate={{ y: [0, 96, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 right-0 h-0.5 bg-cyan-300 shadow-[0_0_10px_#22D3EE] z-10"
            />
          )}

          {/* Header Metadata */}
          <div className="flex justify-between items-center text-[7px] font-mono text-cyan-300">
            <span className="font-bold">[LOCKED: 09]</span>
            <span className="text-emerald-400">99.4% CONF</span>
          </div>

          {/* Center Crosshair */}
          <div className="self-center flex items-center justify-center">
            {isHovered ? (
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border border-dashed border-cyan-400/80 flex items-center justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </motion.div>
            ) : (
              <div className="w-8 h-8 rounded-full border border-dashed border-cyan-400/80 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
            )}
          </div>

          {/* Bottom Telemetry */}
          <div className="text-[7px] font-mono text-cyan-400/80 truncate">
            LAT: 37.77°N | LON: 122.41°W
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'glitch-master',
    titleKey: 'toolGlitch',
    descKey: 'toolGlitchDesc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-[#B026FF]/20 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        {isHovered && (
          <motion.div
            animate={{ x: [-2, 2, -2, 2, 0], opacity: [1, 0.8, 1, 0.5, 1] }}
            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 1 }}
            className="w-16 h-16 bg-[#B026FF]/40 rounded skew-x-12"
          />
        )}
      </div>
    )
  },
  {
    id: 'stage-light',
    titleKey: 'tool_stage_light_title',
    descKey: 'tool_stage_light_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-blue-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden opacity-40">
        {isHovered && (
          <motion.div
            animate={{
              x: ['0%', '100%', '0%'],
              y: ['0%', '100%', '0%'],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-64 h-64 bg-blue-500/30 rounded-full blur-[50px] absolute -top-10 -left-10"
          />
        )}
      </div>
    )
  },
  {
    id: 'logo-match-cut',
    titleKey: 'tool_logo_title',
    descKey: 'tool_logo_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-lime-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        <motion.div
          animate={{ rotate: isHovered ? 180 : 0, scale: isHovered ? 1.2 : 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="w-32 h-32 text-lime-400 opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2z" />
          </svg>
        </motion.div>
      </div>
    )
  },
  {
    id: 'face-match-cut',
    titleKey: 'tool_face_title',
    descKey: 'tool_face_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-purple-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-32 border-2 border-dashed border-purple-400/50 rounded-full flex items-center justify-center"
          >
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" />
          </motion.div>
        ) : (
          <div className="w-24 h-32 border-2 border-dashed border-purple-400/50 rounded-full flex items-center justify-center" />
        )}
      </div>
    )
  },
  {
    id: 'object-match-cut',
    titleKey: 'tool_object_title',
    descKey: 'tool_object_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-orange-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ borderRadius: ["20%", "50%", "20%"], rotate: 90 }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-32 h-32 border-4 border-orange-500/30 bg-orange-500/10"
          />
        ) : (
          <div className="w-32 h-32 border-4 border-orange-500/30 bg-orange-500/10 rounded-[20%]" />
        )}
      </div>
    )
  },
  {
    id: 'paper-cut',
    titleKey: 'tool_paper_title',
    descKey: 'tool_paper_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-red-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden opacity-40">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <path
            fill="none"
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth="4"
            d="M0 50 Q 50 10 100 50 T 200 50 T 300 50 T 400 50"
          >
            {isHovered && (
              <animate
                attributeName="d"
                dur="1s"
                repeatCount="indefinite"
                values="M0 50 Q 50 10 100 50 T 200 50 T 300 50 T 400 50; M0 50 Q 50 90 100 50 T 200 50 T 300 50 T 400 50; M0 50 Q 50 10 100 50 T 200 50 T 300 50 T 400 50"
              />
            )}
          </path>
        </svg>
      </div>
    )
  },
  {
    id: 'baby-track',
    titleKey: 'tool_baby_title',
    descKey: 'tool_baby_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-cyan-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ x: [-20, 20, -20], y: [-10, 10, -10] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-2 border-cyan-400 relative"
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />
          </motion.div>
        ) : (
          <div className="w-20 h-20 border-2 border-cyan-400 relative">
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />
          </div>
        )}
      </div>
    )
  },
  {
    id: 'text-morph',
    titleKey: 'tool_morph_title',
    descKey: 'tool_morph_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-fuchsia-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ filter: ['blur(10px)', 'blur(0px)', 'blur(10px)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-white text-3xl font-serif"
          >
            Morph
          </motion.div>
        ) : (
          <div className="text-white text-3xl font-serif blur-[5px]">Morph</div>
        )}
      </div>
    )
  },
  {
    id: 'glitch-master',
    titleKey: 'tool_glitch_title',
    descKey: 'tool_glitch_desc',
    path: '/effects/glitch-master',
    isPro: true,
    isSoon: false,
    bgClass: 'from-fuchsia-900 via-purple-950 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-50 overflow-hidden">
        {isHovered ? (
          <motion.div
            animate={{ x: [-8, 8, -4, 4, 0], filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)'] }}
            transition={{ duration: 0.3, repeat: Infinity }}
            className="text-white text-3xl font-black tracking-widest uppercase italic"
          >
            GLITCH
          </motion.div>
        ) : (
          <div className="text-white/60 text-3xl font-black tracking-widest uppercase italic">GLITCH</div>
        )}
      </div>
    )
  },
  {
    id: 'scanline',
    titleKey: 'tool_scanline_title',
    descKey: 'tool_scanline_desc',
    path: '/effects/scanline',
    isPro: true,
    isSoon: false,
    bgClass: 'from-emerald-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 overflow-hidden opacity-40">
        {isHovered && (
          <motion.div
            animate={{ y: ['-100%', '300%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-full h-8 bg-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.5)] absolute top-0"
          />
        )}
        <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4FAfzD4QAAAABJRU5ErkJggg==')] opacity-20 mix-blend-overlay"></div>
      </div>
    )
  },
  {
    id: 'typewriter',
    titleKey: 'tool_typewriter_title',
    descKey: 'tool_typewriter_desc',
    path: '/effects/typewriter',
    isPro: true,
    isSoon: false,
    bgClass: 'from-amber-950/40 via-stone-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Typewriter Roller Platen */}
        <div className="w-48 h-3.5 bg-stone-800 border border-stone-600 rounded-t-sm shadow-inner flex items-center justify-between px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-600 border border-stone-500" />
          <div className="h-0.5 w-32 bg-stone-700 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-600 border border-stone-500" />
        </div>

        {/* Vintage Paper coming out of roller */}
        <div className="w-40 bg-[#FAF7EE]/90 text-stone-900 border border-stone-300 rounded-b shadow-lg p-2.5 flex flex-col gap-1.5 -mt-0.5 relative">
          <div className="text-[9px] font-mono tracking-widest text-stone-500 uppercase border-b border-stone-300/80 pb-1 flex justify-between items-center">
            <span>ROYAL 1954</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-600/80" />
          </div>

          <div className="font-serif text-xs font-bold text-stone-900 tracking-wider flex items-center min-h-[20px]">
            <motion.span
              animate={isHovered ? { width: ['0%', '100%', '100%', '0%'] } : { width: '100%' }}
              transition={isHovered ? { duration: 2.8, repeat: Infinity, times: [0, 0.5, 0.85, 1], ease: 'linear' } : { duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden inline-block"
            >
              TYPEWRITER
            </motion.span>
            <motion.span
              animate={isHovered ? { opacity: [1, 0, 1], scaleY: [1, 1.3, 1] } : { opacity: 1 }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-[2px] h-3.5 bg-stone-900 ml-0.5"
            />
          </div>

          <div className="w-full flex gap-1">
            <div className="w-2/3 h-1 bg-stone-300 rounded-full" />
            <div className="w-1/3 h-1 bg-stone-200 rounded-full" />
          </div>
        </div>

        {/* Vintage Typewriter Round Key Caps Row */}
        <div className="flex gap-1.5 mt-2 opacity-60">
          {['Q', 'W', 'E', 'R', 'T', 'Y'].map((k) => (
            <motion.div
              key={k}
              animate={isHovered ? { y: [0, 2, 0] } : { y: 0 }}
              transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0, delay: (k.charCodeAt(0) % 5) * 0.1 }}
              className="w-4 h-4 rounded-full border border-stone-400 bg-stone-900 text-[8px] font-mono font-bold text-stone-300 flex items-center justify-center shadow"
            >
              {k}
            </motion.div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'vhs-tape',
    titleKey: 'tool_vhs_title',
    descKey: 'tool_vhs_desc',
    path: '/effects/vhs-tape',
    isPro: true,
    isSoon: false,
    bgClass: 'from-blue-800 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40 overflow-hidden">
        {isHovered && (
          <>
            <motion.div
              animate={{ x: [-5, 5, -3, 4, 0] }}
              transition={{ duration: 0.2, repeat: Infinity }}
              className="absolute inset-0 bg-red-500/10 mix-blend-screen"
            />
            <motion.div
              animate={{ x: [5, -5, 4, -3, 0] }}
              transition={{ duration: 0.2, repeat: Infinity, delay: 0.1 }}
              className="absolute inset-0 bg-blue-500/10 mix-blend-screen"
            />
          </>
        )}
        <div className="text-3xl font-black text-white/40 tracking-widest uppercase italic">VHS</div>
      </div>
    )
  },
  {
    id: 'magazine-letters',
    titleKey: 'tool_magazine_title',
    descKey: 'tool_magazine_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-pink-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex flex-wrap gap-2 items-center justify-center opacity-50 p-8">
        {['R', 'A', 'N', 'S', 'O', 'M'].map((letter, i) => (
          isHovered ? (
            <motion.div
              key={i}
              animate={{ rotate: [-10 + Math.random() * 20, 10 - Math.random() * 20, -10 + Math.random() * 20] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
              className={`w-10 h-12 flex items-center justify-center font-bold text-xl shadow-lg ${['bg-red-200 text-black', 'bg-blue-900 text-white', 'bg-yellow-300 text-black', 'bg-zinc-200 text-black', 'bg-green-800 text-white', 'bg-pink-300 text-black'][i]}`}
            >
              {letter}
            </motion.div>
          ) : (
            <div key={i} className={`w-10 h-12 flex items-center justify-center font-bold text-xl shadow-lg ${['bg-red-200 text-black', 'bg-blue-900 text-white', 'bg-yellow-300 text-black', 'bg-zinc-200 text-black', 'bg-green-800 text-white', 'bg-pink-300 text-black'][i]} ${i%2===0?'rotate-[5deg]':'-rotate-[5deg]'}`}>
              {letter}
            </div>
          )
        ))}
      </div>
    )
  },
  {
    id: 'word-orbit',
    titleKey: 'tool_orbit_title',
    descKey: 'tool_orbit_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-sky-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-40 h-40 border border-sky-400/20 rounded-full relative"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-400/50 text-xs px-2 rounded-full font-mono">orbit</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-sky-400/50 text-xs px-2 rounded-full font-mono">words</div>
          </motion.div>
        ) : (
          <div className="w-40 h-40 border border-sky-400/20 rounded-full relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-400/50 text-xs px-2 rounded-full font-mono">orbit</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-sky-400/50 text-xs px-2 rounded-full font-mono">words</div>
          </div>
        )}
      </div>
    )
  },
  {
    id: 'echo',
    titleKey: 'tool_echo_title',
    descKey: 'tool_echo_desc',
    path: '/effects/echo',
    isPro: true,
    isSoon: false,
    bgClass: 'from-indigo-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        {isHovered ? (
          <>
            <motion.div animate={{ scale: [1, 2.5], opacity: [0.8, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute w-16 h-16 border-2 border-indigo-400 rounded-full" />
            <motion.div animate={{ scale: [1, 2.5], opacity: [0.8, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }} className="absolute w-16 h-16 border-2 border-indigo-400 rounded-full" />
            <motion.div animate={{ scale: [1, 2.5], opacity: [0.8, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} className="absolute w-16 h-16 border-2 border-indigo-400 rounded-full" />
          </>
        ) : (
          <div className="w-16 h-16 border-2 border-indigo-400/50 rounded-full" />
        )}
      </div>
    )
  },
  {
    id: 'droste',
    titleKey: 'tool_droste_title',
    descKey: 'tool_droste_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-amber-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40 overflow-hidden">
        {isHovered ? (
          <motion.div
            animate={{ scale: [1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-48 h-48 border-4 border-amber-500/50 flex items-center justify-center bg-zinc-900/50"
          >
            <div className="w-24 h-24 border-4 border-amber-500/50 flex items-center justify-center bg-zinc-900/50">
               <div className="w-12 h-12 border-4 border-amber-500/50 bg-zinc-900/50" />
            </div>
          </motion.div>
        ) : (
          <div className="w-48 h-48 border-4 border-amber-500/50 flex items-center justify-center bg-zinc-900/50">
            <div className="w-24 h-24 border-4 border-amber-500/50 flex items-center justify-center bg-zinc-900/50">
               <div className="w-12 h-12 border-4 border-amber-500/50 bg-zinc-900/50" />
            </div>
          </div>
        )}
      </div>
    )
  },
  {
    id: 'ascii',
    titleKey: 'tool_ascii_title',
    descKey: 'tool_ascii_desc',
    path: '/effects/ascii',
    isPro: true,
    isSoon: false,
    bgClass: 'from-green-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40 font-mono text-green-400 text-[10px] overflow-hidden leading-none break-all p-4">
        {isHovered ? (
          <motion.div animate={{ y: [0, -40] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            {'10'.repeat(50)}<br/>{'01'.repeat(50)}<br/>{'11'.repeat(50)}<br/>{'00'.repeat(50)}<br/>{'10'.repeat(50)}<br/>{'01'.repeat(50)}
          </motion.div>
        ) : (
          <div>{'10'.repeat(50)}<br/>{'01'.repeat(50)}<br/>{'11'.repeat(50)}<br/>{'00'.repeat(50)}</div>
        )}
      </div>
    )
  },
  {
    id: 'halftone',
    titleKey: 'tool_halftone_title',
    descKey: 'tool_halftone_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-gray-700 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <div className={`w-full h-full bg-[radial-gradient(circle,theme(colors.white)_2px,transparent_2px)] bg-[length:12px_12px] ${isHovered ? 'animate-pulse' : ''}`}></div>
      </div>
    )
  },
  {
    id: 'velocity',
    titleKey: 'tool_velocity_title',
    descKey: 'tool_velocity_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-violet-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ scaleX: [1, 3], opacity: [1, 0], x: [0, 50] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="w-24 h-2 bg-violet-400 blur-sm rounded-full"
          />
        ) : (
          <div className="w-24 h-2 bg-violet-400/50 rounded-full" />
        )}
      </div>
    )
  },
  {
    id: 'magnifier',
    titleKey: 'tool_magnifier_title',
    descKey: 'tool_magnifier_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-teal-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40 overflow-hidden">
        <div className="w-full text-xs text-teal-200/20 font-serif p-4 blur-[1px]">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </div>
        {isHovered && (
          <motion.div
            animate={{ x: [-80, 80, -80] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-24 h-24 border-4 border-teal-400/50 rounded-full backdrop-blur-sm bg-teal-400/10 shadow-[inset_0_0_20px_rgba(45,212,191,0.3)]"
          />
        )}
      </div>
    )
  },
  {
    id: 'paper-fold',
    titleKey: 'tool_paperfold_title',
    descKey: 'tool_paperfold_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-rose-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40" style={{ perspective: '800px' }}>
        {isHovered ? (
          <motion.div
            animate={{ rotateX: [0, 60, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-24 h-24 bg-white/10 shadow-lg border-b border-white/30"
            style={{ transformOrigin: 'bottom' }}
          >
            <motion.div
              animate={{ rotateX: [0, -120, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-full h-full bg-white/20 border-t border-white/30 absolute bottom-full origin-bottom"
            />
          </motion.div>
        ) : (
          <div className="w-24 h-24 bg-white/10 shadow-lg border-b border-white/30" style={{ transformOrigin: 'bottom' }}>
            <div className="w-full h-full bg-white/20 border-t border-white/30 absolute bottom-full origin-bottom" />
          </div>
        )}
      </div>
    )
  },
  {
    id: 'mixed-media',
    titleKey: 'tool_mixedmedia_title',
    descKey: 'tool_mixedmedia_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-yellow-900 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <div className="w-24 h-24 bg-zinc-800 rounded-md relative flex items-center justify-center border border-zinc-700">
          <div className="w-16 h-16 bg-zinc-700 rounded-sm"></div>
        </div>
        {isHovered && (
          <motion.svg
            animate={{ pathLength: [0, 1], opacity: [1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute w-32 h-32 text-yellow-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </motion.svg>
        )}
      </div>
    )
  },
  {
    id: 'audio-waveform',
    titleKey: 'tool_audiowave_title',
    descKey: 'tool_audiowave_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-cyan-950 via-sky-900/40 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-50 px-6">
        {[0.3, 0.7, 0.4, 0.9, 0.6, 1, 0.5, 0.8, 0.35, 0.75, 0.45, 0.85, 0.5, 0.65, 0.3].map((height, i) => (
          <motion.div
            key={i}
            animate={
              isHovered
                ? {
                    height: [`${height * 20}%`, `${Math.max(20, Math.min(95, (1 - height) * 100))}%`, `${height * 65}%`],
                    backgroundColor: ['#06b6d4', '#3b82f6', '#8b5cf6', '#06b6d4']
                  }
                : {
                    height: `${height * 50}%`,
                    backgroundColor: '#06b6d4'
                  }
            }
            transition={
              isHovered
                ? {
                    duration: 0.8 + (i % 5) * 0.15,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: (i * 0.05) % 0.4
                  }
                : { duration: 0.3 }
            }
            className="w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
          />
        ))}
      </div>
    )
  },
  {
    id: 'newspaper',
    titleKey: 'tool_newspaper_title',
    descKey: 'tool_newspaper_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-orange-900/50 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 px-6 sepia-[.5]">
        <div className="w-full h-8 border-b-4 border-double border-white/30 mb-2 flex items-center justify-center">
           <div className="text-xl font-serif font-black tracking-widest text-white/50">NEWS</div>
        </div>
        <div className="w-full flex gap-4">
           <div className="flex-1 flex flex-col gap-2">
             <div className="w-full h-2 bg-white/20"></div>
             <div className="w-full h-2 bg-white/20"></div>
             <div className="w-3/4 h-2 bg-white/20"></div>
           </div>
           <div className="w-16 h-16 bg-white/10 shrink-0 relative overflow-hidden">
             {isHovered && <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 bg-white/10" />}
           </div>
        </div>
      </div>
    )
  },
  {
    id: 'book',
    titleKey: 'tool_book_title',
    descKey: 'tool_book_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-stone-800 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-50" style={{ perspective: '1000px' }}>
        <div className="relative flex items-center shadow-2xl rounded-sm" style={{ transformStyle: 'preserve-3d' }}>
          {/* Left Page (Static Base) */}
          <div className="w-24 h-32 bg-stone-100/10 border-r border-stone-400/30 rounded-l-sm flex flex-col justify-center p-3 gap-1.5 shadow-inner">
            <div className="w-full h-1.5 bg-white/20 rounded-full" />
            <div className="w-4/5 h-1.5 bg-white/20 rounded-full" />
            <div className="w-3/4 h-1.5 bg-white/20 rounded-full" />
            <div className="w-5/6 h-1.5 bg-white/10 rounded-full mt-2" />
          </div>

          {/* Right Page (Static Base) */}
          <div className="w-24 h-32 bg-stone-100/5 border-l border-stone-400/30 rounded-r-sm flex flex-col justify-center p-3 gap-1.5 shadow-inner">
            <div className="w-full h-1.5 bg-white/20 rounded-full" />
            <div className="w-4/5 h-1.5 bg-white/20 rounded-full" />
            <div className="w-3/4 h-1.5 bg-white/20 rounded-full" />
            <div className="w-2/3 h-1.5 bg-white/10 rounded-full mt-2" />
          </div>

          {/* Turning Page (Anchored to Center Spine) */}
          {isHovered && (
            <motion.div
              animate={{ rotateY: [0, -180] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
              className="absolute right-0 top-0 w-24 h-32 bg-stone-100/20 border border-stone-300/30 rounded-r-sm p-3 flex flex-col justify-center gap-1.5 shadow-md"
              style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
            >
              <div className="w-full h-1.5 bg-white/30 rounded-full" />
              <div className="w-4/5 h-1.5 bg-white/30 rounded-full" />
              <div className="w-3/4 h-1.5 bg-white/30 rounded-full" />
            </motion.div>
          )}

          {/* Book Spine Center Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-stone-400/40 shadow-sm" />
        </div>
      </div>
    )
  }
];

// Her kart artık kendi hover state'ini tutuyor -> bir karta hover yapmak
// diğer 8 kartı yeniden render etmiyor (asıl kasma buradaydı)
const ToolCard = memo(function ToolCard({ tool, lang, onNavigate, user }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    if (tool.isPro && !user?.isPro) {
      onNavigate('/pricing');
    } else if (tool.path !== '#') {
      onNavigate(tool.path);
    } else {
      const el = e.currentTarget;
      el.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(0)' }
      ], { duration: 300 });
    }
  }, [tool.path, tool.isPro, user?.isPro, onNavigate]);

  return (
    <motion.a
      href={tool.path !== '#' ? tool.path : undefined}
      onClick={handleClick}
      variants={itemVariants}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative h-64 sm:h-72 rounded-[2rem] overflow-hidden bg-gradient-to-br ${tool.bgClass} border border-zinc-800/50 hover:border-zinc-700/80 transition-all duration-300 hover:-translate-y-1 shadow-2xl cursor-pointer block select-none`}
    >
      {tool.effect(isHovered)}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"></div>

      <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20 pointer-events-none select-none">
        {tool.isFree && (
          <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider shadow-sm">
            {t('free', lang) || 'FREE'}
          </div>
        )}
        {tool.isPro && (
          <div className="bg-[#F5B301] text-black text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider shadow-sm">
            {t('pro', lang) || 'PRO'}
          </div>
        )}
        {tool.isSoon && (
          <div className="bg-zinc-800/90 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider border border-zinc-700/50 shadow-sm">
            {t('soon', lang) || 'SOON'}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 z-20 pointer-events-none">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 transition-transform duration-200 group-hover:-translate-y-0.5">
          {t(tool.titleKey, lang)}
        </h2>
        <p className="text-sm text-zinc-300 line-clamp-2 transition-opacity duration-200 opacity-80 group-hover:opacity-100">
          {t(tool.descKey, lang)}
        </p>
      </div>
    </motion.a>
  );
});

const Tools = () => {
  const lang = useSettingsStore((state) => state.lang);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const scrollTimeout = useRef(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        if (gridRef.current) gridRef.current.style.pointerEvents = 'none';
      }
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

      scrollTimeout.current = setTimeout(() => {
        isScrollingRef.current = false;
        if (gridRef.current) gridRef.current.style.pointerEvents = '';
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return (
    <div className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 pt-8 sm:pt-12 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-16 flex flex-col relative z-10 min-h-[calc(100vh-80px)]">
      <Helmet>
        <title>{lang === 'tr' ? 'Tüm Video Efekt Araçları | AnimationMaker' : 'All Video Effect Tools | AnimationMaker'}</title>
        <meta name="description" content={lang === 'tr' ? 'Match Cut, Ken Burns, VHS Kaset, Glitch Master, Daktilo, Tarama Çizgisi, Belge Vurgulama ve Takip efektleri gibi tarayıcı tabanlı video animasyon araçlarımızı keşfedin.' : 'Explore our comprehensive browser-based video creation tools: Match Cut, Ken Burns, VHS Tape, Glitch Master, Typewriter, Scanline, Document Spotlight, and Motion Tracking.'} />
        <meta name="keywords" content="video effect suite, match cut, ken burns online, glitch master, typewriter effect, scanline crt, ascii video, spotlight highlighter, paper collage, motion tracking, animationmaker" />
        <link rel="canonical" href="https://animationmaker.m0s.space/tools" />
        
        {/* Multilingual Hreflang Tags */}
        <link rel="alternate" hrefLang="x-default" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="en" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="tr" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="de" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="fr" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="es" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="zh" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="ar" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="ko" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="ja" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="id" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="th" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="hi" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="ru" href="https://animationmaker.m0s.space/tools" />
        <link rel="alternate" hrefLang="pt" href="https://animationmaker.m0s.space/tools" />

        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content="All Video Effect Tools | AnimationMaker" />
        <meta property="og:description" content="Discover powerful browser-based video animation and motion graphics tools." />
        <meta property="og:url" content="https://animationmaker.m0s.space/tools" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="All Video Effect Tools | AnimationMaker" />
        <meta name="twitter:description" content="Discover powerful browser-based video animation and motion graphics tools." />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": "AnimationMaker Video Creation Tools",
              "description": "A collection of online browser-based video effects and kinetic typography tools.",
              "url": "https://animationmaker.m0s.space/tools",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Text Match Cut", "url": "https://animationmaker.m0s.space/match-cut" },
                { "@type": "ListItem", "position": 2, "name": "Ken Burns Zoom", "url": "https://animationmaker.m0s.space/effects/ken-burns" },
                { "@type": "ListItem", "position": 3, "name": "VHS Tape Effect", "url": "https://animationmaker.m0s.space/effects/vhs-tape" },
                { "@type": "ListItem", "position": 4, "name": "Glitch Master", "url": "https://animationmaker.m0s.space/effects/glitch-master" },
                { "@type": "ListItem", "position": 5, "name": "Typewriter Text", "url": "https://animationmaker.m0s.space/effects/typewriter" },
                { "@type": "ListItem", "position": 6, "name": "Scanline CRT", "url": "https://animationmaker.m0s.space/effects/scanline" },
                { "@type": "ListItem", "position": 7, "name": "ASCII Art Video", "url": "https://animationmaker.m0s.space/effects/ascii" },
                { "@type": "ListItem", "position": 8, "name": "Echo Video Trails", "url": "https://animationmaker.m0s.space/effects/echo" },
                { "@type": "ListItem", "position": 9, "name": "Google Search Animator", "url": "https://animationmaker.m0s.space/effects/gsearch" },
                { "@type": "ListItem", "position": 10, "name": "Document Spotlight Highlighter", "url": "https://animationmaker.m0s.space/effects/spotlight" },
                { "@type": "ListItem", "position": 11, "name": "Formula & Math Particle Animator", "url": "https://animationmaker.m0s.space/effects/formula" },
                { "@type": "ListItem", "position": 12, "name": "Timeline & History Animator", "url": "https://animationmaker.m0s.space/effects/timeline" },
                { "@type": "ListItem", "position": 13, "name": "Tree Branching Diagram", "url": "https://animationmaker.m0s.space/effects/tree" },
                { "@type": "ListItem", "position": 14, "name": "Data Counter & Odometer", "url": "https://animationmaker.m0s.space/effects/counter" },
                { "@type": "ListItem", "position": 15, "name": "Paper Cutout Collage", "url": "https://animationmaker.m0s.space/effects/paper" },
                { "@type": "ListItem", "position": 16, "name": "AI Target Tracking HUD", "url": "https://animationmaker.m0s.space/effects/tracking" }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://animationmaker.m0s.space"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Tools",
                  "item": "https://animationmaker.m0s.space/tools"
                }
              ]
            }
          ])}
        </script>
      </Helmet>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/10 to-transparent rounded-full pointer-events-none z-0"></div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 sm:mb-16 mt-4"
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight">
          {t('toolsTitle1', lang)}
          <span className="text-[#F5B301] italic">{t('toolsTitle2', lang)}</span>
          <span className="text-zinc-400 font-medium">{t('toolsTitle3', lang)}</span>
        </h1>
      </motion.div>

      <div ref={gridRef}>
        {/* Available Tools */}
        <div className="mb-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-2 h-8 bg-gradient-to-b from-[#F5B301] to-[#FF9D00] rounded-full shadow-[0_0_10px_rgba(245,179,1,0.5)]"></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {t('availableTools', lang)}
            </h2>
          </motion.div>
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8"
          >
            {TOOLS.filter(tool => !tool.isSoon).map((tool) => (
              <ToolCard key={tool.id} tool={tool} lang={lang} onNavigate={navigate} user={user} />
            ))}
          </motion.div>
        </div>

        {/* Coming Soon Tools */}
        <div className="mt-16 sm:mt-24 content-auto contain-paint">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3 mb-6 opacity-70"
          >
            <div className="w-2 h-8 bg-zinc-700 rounded-full"></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-400 tracking-tight">
              {t('comingSoonTools', lang)}
            </h2>
          </motion.div>
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 opacity-70 hover:opacity-100 transition-opacity duration-500"
          >
            {TOOLS.filter(tool => tool.isSoon).map((tool) => (
              <ToolCard key={tool.id} tool={tool} lang={lang} onNavigate={navigate} user={user} />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Tools;