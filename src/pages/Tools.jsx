import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';

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
    path: '#',
    isPro: true,
    isSoon: true,
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
  }
];

// Her kart artık kendi hover state'ini tutuyor -> bir karta hover yapmak
// diğer 8 kartı yeniden render etmiyor (asıl kasma buradaydı)
const ToolCard = memo(function ToolCard({ tool, lang, onNavigate }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    if (tool.path !== '#') {
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
  }, [tool.path, onNavigate]);

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
    <div className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12 flex flex-col relative z-10 min-h-[calc(100vh-80px)]">

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

      <motion.div
        ref={gridRef}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8"
      >
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} lang={lang} onNavigate={navigate} />
        ))}
      </motion.div>
    </div>
  );
};

export default Tools;