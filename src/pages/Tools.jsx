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
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
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
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40">
        <motion.div
          initial={false}
          animate={{ scale: isHovered ? 1.1 : 1, opacity: isHovered ? 0.6 : 0.3 }}
          transition={{ duration: 0.5 }}
          className="w-[150%] h-[150%] flex flex-col justify-center gap-4 rotate-[-15deg]"
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 w-full bg-white/10 rounded-full" />
          ))}
          {isHovered && (
            <motion.div
              animate={{ x: ['-20%', '20%', '-20%'] }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute w-32 h-64 bg-[#F5B301]/20 blur-3xl rotate-12"
            />
          )}
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
    id: 'spotlight',
    titleKey: 'tool_spotlight_title',
    descKey: 'tool_spotlight_desc',
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
    bgClass: 'from-zinc-700 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        {isHovered ? (
          <motion.div
            animate={{ opacity: [0, 1], width: ['0%', '100%'] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
            className="text-white font-mono text-xl whitespace-nowrap overflow-hidden border-r-2 border-white pr-1"
          >
            _Typewriter
          </motion.div>
        ) : (
          <div className="text-white font-mono text-xl whitespace-nowrap">_Typewriter</div>
        )}
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
    id: 'google-search',
    titleKey: 'tool_gsearch_title',
    descKey: 'tool_gsearch_desc',
    path: '#',
    isPro: true,
    isSoon: true,
    bgClass: 'from-gray-800 to-zinc-900',
    effect: (isHovered) => (
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <div className="w-48 h-12 bg-white/10 rounded-full border border-white/20 flex items-center px-4 overflow-hidden relative">
          <div className="w-4 h-4 rounded-full border-2 border-blue-400 mr-2 flex-shrink-0" />
          {isHovered ? (
            <motion.div
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
              className="h-2 bg-white/30 rounded-full w-full origin-left"
            />
          ) : (
            <div className="h-2 bg-white/30 rounded-full w-full origin-left" />
          )}
        </div>
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
      <div className="absolute inset-0 flex items-center justify-center opacity-40 perspective-1000">
        <div className="w-32 h-40 bg-white/10 border-r border-white/30 relative origin-left" style={{ transformStyle: 'preserve-3d' }}>
           {isHovered && (
             <motion.div
               animate={{ rotateY: [0, -180] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
               className="absolute inset-0 bg-white/20 border border-white/30 origin-left"
             />
           )}
        </div>
        <div className="w-32 h-40 bg-white/5 border-l border-white/30"></div>
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
      className={`group relative h-64 sm:h-72 rounded-[2rem] overflow-hidden bg-gradient-to-br ${tool.bgClass} border border-zinc-800/50 hover:border-zinc-700/80 transition-colors shadow-2xl cursor-pointer block`}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      {tool.effect(isHovered)}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>

      <div className="absolute top-4 right-4 flex gap-2 z-20">
        {tool.isFree && (
          <div className="bg-green-500/30 text-green-400 border border-green-500/50 text-[10px] font-black px-2 py-1 rounded-md tracking-wider">
            {t('free', lang) || 'FREE'}
          </div>
        )}
        {tool.isPro && (
          <div className="bg-[#F5B301] text-black text-[10px] font-black px-2 py-1 rounded-md tracking-wider">
            {t('pro', lang) || 'PRO'}
          </div>
        )}
        {tool.isSoon && (
          <div className="bg-zinc-800/90 text-white text-[10px] font-bold px-2 py-1 rounded-md tracking-wider border border-zinc-700/50">
            {t('soon', lang) || 'SOON'}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 z-20">
        <motion.h2
          animate={{ y: isHovered ? -5 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-xl sm:text-2xl font-bold text-white mb-1"
        >
          {t(tool.titleKey, lang)}
        </motion.h2>
        <motion.p
          animate={{ opacity: isHovered ? 1 : 0.7 }}
          className="text-sm text-zinc-300 line-clamp-2"
        >
          {t(tool.descKey, lang)}
        </motion.p>
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

    // passive: true -> tarayıcı scroll'u JS'i beklemeden işleyebiliyor (asıl kasma kaynağı buydu)
    // capture: true korunuyor -> iç içe scroll container'ları da yakalanabilsin diye
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
        <meta name="description" content={lang === 'tr' ? 'Match Cut, Ken Burns, VHS Kaset, Glitch Master, Daktilo, Tarama Çizgisi, ASCII ve Yankı efektleri gibi tarayıcı tabanlı video animasyon araçlarımızı keşfedin.' : 'Explore our comprehensive browser-based video creation tools: Match Cut, Ken Burns, VHS Tape, Glitch Master, Typewriter, Scanline, ASCII, and Echo.'} />
        <meta name="keywords" content="video effect suite, match cut, ken burns online, glitch master, typewriter effect, scanline crt, ascii video, echo video effect, animationmaker" />
        <link rel="canonical" href="https://animationmaker.m0s.space/tools" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content="All Video Effect Tools | AnimationMaker" />
        <meta property="og:description" content="Discover powerful browser-based video animation tools." />
        <meta property="og:url" content="https://animationmaker.m0s.space/tools" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="All Video Effect Tools | AnimationMaker" />
        <meta name="twitter:description" content="Discover powerful browser-based video animation tools." />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/logo.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "AnimationMaker Video Creation Tools",
            "description": "A collection of online browser-based video effects and kinetic typography tools.",
            "url": "https://animationmaker.m0s.space/tools",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Match Cut Effect",
                "url": "https://animationmaker.m0s.space/match-cut"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Ken Burns Pro",
                "url": "https://animationmaker.m0s.space/effects/ken-burns"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "VHS Tape Effect",
                "url": "https://animationmaker.m0s.space/effects/vhs-tape"
              },
              {
                "@type": "ListItem",
                "position": 4,
                "name": "Glitch Master",
                "url": "https://animationmaker.m0s.space/effects/glitch-master"
              },
              {
                "@type": "ListItem",
                "position": 5,
                "name": "Typewriter Text",
                "url": "https://animationmaker.m0s.space/effects/typewriter"
              },
              {
                "@type": "ListItem",
                "position": 6,
                "name": "Scanline CRT",
                "url": "https://animationmaker.m0s.space/effects/scanline"
              },
              {
                "@type": "ListItem",
                "position": 7,
                "name": "ASCII Art Video",
                "url": "https://animationmaker.m0s.space/effects/ascii"
              },
              {
                "@type": "ListItem",
                "position": 8,
                "name": "Echo Video Trails",
                "url": "https://animationmaker.m0s.space/effects/echo"
              }
            ]
          })}
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
              {lang === 'tr' ? 'Kullanılabilir Araçlar' : 'Available Tools'}
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
        <div className="mt-16 sm:mt-24">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3 mb-6 opacity-70"
          >
            <div className="w-2 h-8 bg-zinc-700 rounded-full"></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-400 tracking-tight">
              {lang === 'tr' ? 'Yakında Gelecekler' : 'Coming Soon'}
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