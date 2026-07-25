import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MousePointer2, Volume2, Zap, Settings, Palette, Download, Play, Layers, ChevronDown, Check, Wand2, Mail, ArrowRight, LayoutGrid } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { t } from '../lib/i18n';
import CookieModal from '../components/modals/CookieModal';

// A component that simulates a cinematic "match cut" effect for the hero word
const HeroCutWord = ({ word }) => {
  const [styleIndex, setStyleIndex] = useState(0);
  
  const styles = [
    { fontFamily: 'Inter', fontWeight: 800, color: 'white', backgroundColor: 'transparent' }, // 0
    { fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#F5B301', backgroundColor: '#1D1D22', padding: '0 8px' }, // 1
    { fontFamily: 'var(--font-display, "Clash Display")', fontWeight: 600, color: '#16161A', backgroundColor: '#F5B301', padding: '0 8px' }, // 2
    { fontFamily: 'Inter', fontWeight: 900, color: 'transparent', WebkitTextStroke: '1px #F5B301', backgroundColor: 'transparent' }, // 3
    { fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#22C55E', backgroundColor: 'transparent', fontStyle: 'italic' }, // 4
    { fontFamily: 'Inter', fontWeight: 800, color: 'white', backgroundColor: '#B026FF', padding: '0 12px', transform: 'skewX(-15deg)' }, // 5: Glitch Purple
    { fontFamily: 'var(--font-display, "Clash Display")', fontWeight: 900, color: '#16161A', backgroundColor: '#FFFFFF', padding: '0 16px', letterSpacing: '-2px' }, // 6: Inverted Flash
    { fontFamily: 'JetBrains Mono', fontWeight: 900, color: 'transparent', WebkitTextStroke: '2px #EF4444', backgroundColor: 'transparent', filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))' }, // 7: Red Neon
    { fontFamily: 'var(--font-display, "Clash Display")', fontWeight: 700, color: '#F5B301', backgroundColor: 'transparent' }, // 8: Final
  ];

  const playAnimation = () => {
    setStyleIndex(1);
    setTimeout(() => setStyleIndex(2), 100);
    setTimeout(() => setStyleIndex(3), 200);
    setTimeout(() => setStyleIndex(4), 300);
    setTimeout(() => setStyleIndex(5), 400);
    setTimeout(() => setStyleIndex(6), 500);
    setTimeout(() => setStyleIndex(7), 600);
    setTimeout(() => setStyleIndex(8), 750);
  };

  useEffect(() => {
    const t1 = setTimeout(playAnimation, 250);
    const t2 = setTimeout(playAnimation, 1200);
    return () => { 
      clearTimeout(t1); 
      clearTimeout(t2); 
    };
  }, []);

  return (
    <span className="relative inline-block">
      {/* Invisible spacer to reserve maximum space and prevent layout shifting */}
      <span className="invisible inline-block px-4 font-display tracking-normal" aria-hidden="true">
        {word}
      </span>
      {/* Absolute wrapper perfectly centering the mutating text */}
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span 
          onMouseEnter={playAnimation}
          className="inline-block transition-none cursor-pointer whitespace-nowrap pointer-events-auto"
          style={{
            ...styles[styleIndex],
            borderRadius: '4px',
          }}
        >
          {word}
        </span>
      </span>
    </span>
  );
};

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-border-color">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold rounded-sm"
      >
        <span className="font-semibold text-text-primary text-lg">{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="text-text-muted w-5 h-5" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-text-muted font-body leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BentoCard = ({ num, title, desc, icon, fullWidth, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay }}
      className={`group flex flex-col md:flex-row items-start gap-4 p-6 md:p-8 rounded-2xl bg-surface/40 border border-border-color hover:border-[#E5FF00] hover:bg-surface/80 hover:shadow-[0_0_30px_rgba(229,255,0,0.05)] transition-all duration-300 ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl border border-border-color bg-bg-base flex items-center justify-center text-[#E5FF00] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-md">
        {icon}
      </div>
      <div className="flex flex-col w-full">
        <div className="flex items-center gap-4 mb-3 opacity-50 group-hover:opacity-100 transition-opacity">
          <span className="font-mono text-xs font-bold text-white">{num}</span>
          <div className="h-[1px] w-full bg-border-color flex-grow"></div>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm md:text-base text-text-muted font-body leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
};

const ToolCard = ({ tool }) => (
  <Link
    to={tool.link}
    className={`group relative overflow-hidden rounded-2xl border ${tool.border} bg-surface p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl flex flex-col items-center text-center`}
  >
    <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-15 bg-gradient-to-br ${tool.color}`}></div>
    <div className={`relative mb-6 rounded-2xl bg-bg-base p-4 border border-border-color shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500`}>
      {tool.icon}
    </div>
    <h3 className="mb-3 font-display text-2xl font-bold text-white">{tool.name}</h3>
    <p className="text-text-muted mb-6 line-clamp-2">{tool.description}</p>
    <div className="mt-auto">
      <span className="inline-block rounded-full border border-border-color bg-bg-base px-3 py-1 text-xs font-mono font-medium text-text-muted group-hover:border-accent-gold group-hover:text-accent-gold transition-colors">
        {tool.badge}
      </span>
    </div>
  </Link>
);

const Home = () => {
  const { lang } = useSettingsStore();
  const { user, openAuthModal } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const isRtl = lang === 'ar';

  const handleStartProject = (e) => {
    if (!user) {
      e.preventDefault();
      openAuthModal({ type: 'NAVIGATE', payload: '/match-cut' });
    }
  };

  useEffect(() => {
    if (location.hash === '#contact') {
      setTimeout(() => {
        const el = document.getElementById('footer-contact');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.hash]);

  const revealVar = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  const bentoItems = [
    { num: '01', title: t('bento1Title', lang), desc: t('bento1Desc', lang), icon: <MousePointer2 className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: true },
    { num: '02', title: t('bento2Title', lang), desc: t('bento2Desc', lang), icon: <Volume2 className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: false },
    { num: '03', title: t('bento3Title', lang), desc: t('bento3Desc', lang), icon: <Zap className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: false },
    { num: '04', title: t('bento4Title', lang), desc: t('bento4Desc', lang), icon: <Settings className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: false },
    { num: '05', title: t('bento5Title', lang), desc: t('bento5Desc', lang), icon: <Palette className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: false },
    { num: '06', title: t('bento6Title', lang), desc: t('bento6Desc', lang), icon: <Download className="w-5 h-5 md:w-6 md:h-6" />, fullWidth: true },
  ];

  const tools = [
    {
      id: 'match-cut',
      name: t('toolMatchCut', lang),
      description: t('toolMatchCutDesc', lang),
      icon: <Layers className="w-6 h-6 text-accent-gold" />,
      color: 'from-accent-gold to-orange-500',
      border: 'border-border-color hover:border-accent-gold',
      link: '/match-cut',
      badge: t('badgeAvailable', lang)
    },
    {
      id: 'ken-burns',
      name: t('toolKenBurns', lang),
      description: t('toolKenBurnsDesc', lang),
      icon: <Play className="w-6 h-6 text-[#00E5FF]" />,
      color: 'from-[#00E5FF] to-blue-500',
      border: 'border-border-color hover:border-[#00E5FF]',
      link: '#',
      badge: t('badgeSoon', lang)
    },
    {
      id: 'glitch',
      name: t('toolGlitch', lang),
      description: t('toolGlitchDesc', lang),
      icon: <Zap className="w-6 h-6 text-[#B026FF]" />,
      color: 'from-[#B026FF] to-pink-500',
      border: 'border-border-color hover:border-[#B026FF]',
      link: '#',
      badge: t('badgeSoon', lang)
    }
  ];

  const compareRows = [
    { label: t('compRow1', lang), v1: t('compR1V1', lang), v2: t('compR1V2', lang), v3: t('compR1V3', lang), v4: t('compR1V4', lang) },
    { label: t('compRow2', lang), v1: t('compR2V1', lang), v2: t('compR2V2', lang), v3: t('compR2V3', lang), v4: t('compR2V4', lang) },
    { label: t('compRow3', lang), v1: t('compR3V1', lang), v2: t('compR3V2', lang), v3: t('compR3V3', lang), v4: t('compR3V4', lang) },
    { label: t('compRow4', lang), v1: t('compR4V1', lang), v2: t('compR4V2', lang), v3: t('compR4V3', lang), v4: t('compR4V4', lang) },
    { label: t('compRow5', lang), v1: t('compR5V1', lang), v2: t('compR5V2', lang), v3: t('compR5V3', lang), v4: t('compR5V4', lang) }
  ];

  return (
    <div className={`w-full flex-grow flex flex-col items-center bg-bg-base text-text-primary overflow-x-hidden ${isRtl ? 'dir-rtl text-right' : 'text-left'}`}>
      
      {/* Subtle Noise Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

      {/* --- HERO SECTION --- */}
      <section className="w-full max-w-[1280px] mx-auto px-6 pt-16 md:pt-24 pb-32 flex flex-col items-center text-center relative z-10">
        <motion.div initial="hidden" animate="visible" variants={revealVar} className="font-mono text-xs font-bold tracking-widest text-text-muted mb-6 uppercase border border-border-color rounded-full px-3 py-1 bg-surface">
          {t('heroEyebrow', lang)}
        </motion.div>
        
        <motion.h1 initial="hidden" animate="visible" variants={revealVar} className="text-5xl md:text-7xl lg:text-[80px] font-display font-extrabold tracking-tight text-white mb-6 leading-[1.05]">
          {t('heroTitle1', lang)} <br className="hidden md:block" />
          <HeroCutWord word={t('heroTitle2', lang)} />
        </motion.h1>

        <motion.p initial="hidden" animate="visible" variants={revealVar} className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-8 font-body">
          {t('heroDesc', lang)}
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={revealVar} className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-sm md:text-base font-medium text-zinc-400 mb-8">
          <span>{t('heroTrust1', lang)}</span>
          <span className="text-zinc-700">|</span>
          <span>{t('heroTrust2', lang)}</span>
          <span className="text-zinc-700">|</span>
          <span>{t('heroTrust3', lang)}</span>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={revealVar} className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full sm:w-auto">
          <Link 
            to="/match-cut" 
            onClick={handleStartProject}
            className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-accent-gold to-[#FF9D00] text-bg-base font-bold text-lg rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(245,179,1,0.4)] flex items-center justify-center gap-3 overflow-hidden"
          >
            {/* Elegant and subtle hover gradient shift */}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
            <Wand2 size={22} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10 tracking-wide">{t('heroCTA', lang)}</span>
          </Link>
        </motion.div>
      </section>

      {/* --- BENTO FEATURES GRID --- */}
      <section className="w-full max-w-[1280px] mx-auto px-6 py-20 relative z-10 border-t border-border-color/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {bentoItems.map((item, idx) => (
            <BentoCard 
              key={idx} 
              num={item.num} 
              title={item.title} 
              desc={item.desc} 
              icon={item.icon} 
              fullWidth={item.fullWidth} 
              delay={idx * 0.1} 
            />
          ))}
        </div>
      </section>

      {/* --- TOOLS GALLERY (Features) --- */}
      <section className="w-full bg-surface-raised border-y border-border-color relative z-10">
        <div className="max-w-[1280px] mx-auto px-6 py-24">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">{t('homeToolsTitle', lang)}</h2>
            <p className="text-text-muted font-body max-w-2xl mx-auto">{t('homeToolsDesc', lang)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tools.map((tool, idx) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
              >
                <ToolCard tool={tool} />
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 flex justify-center"
          >
            <Link 
              to="/tools" 
              className="group relative px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-[#F5B301] text-white font-medium rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(245,179,1,0.2)] flex items-center justify-center gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#F5B301]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
              <LayoutGrid size={18} className="relative z-10 group-hover:text-[#F5B301] transition-colors" />
              <span className="relative z-10 tracking-wide">{t('seeAllTools', lang) || 'View All Tools'}</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* --- COMPARISON TABLE --- */}
      <section className="w-full max-w-[1000px] mx-auto px-6 py-24 relative z-10">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold">{t('compareTitle', lang)}</h2>
        </div>
        <div className="overflow-x-auto border border-border-color rounded-xl bg-surface custom-scrollbar hover:border-accent-gold/50 transition-colors duration-500">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border-color text-sm uppercase tracking-wider font-mono">
                <th className="p-4 md:p-6 font-normal text-text-muted w-1/4"></th>
                <th className="p-4 md:p-6 font-bold text-bg-base bg-accent-gold w-1/4 shadow-sm">{t('compCol1', lang)}</th>
                <th className="p-4 md:p-6 font-bold text-text-muted bg-surface-raised w-1/6">{t('compCol2', lang)}</th>
                <th className="p-4 md:p-6 font-bold text-text-muted bg-surface-raised w-1/6">{t('compCol3', lang)}</th>
                <th className="p-4 md:p-6 font-bold text-text-muted bg-surface-raised w-1/6">{t('compCol4', lang)}</th>
              </tr>
            </thead>
            <tbody className="text-sm font-body">
              {compareRows.map((row, idx) => (
                <tr key={idx} className="border-b border-border-color last:border-0 hover:bg-surface-raised transition-colors group">
                  <td className="p-4 md:p-6 text-text-muted">{row.label}</td>
                  <td className="p-4 md:p-6 font-bold text-accent-gold bg-accent-gold/5 group-hover:bg-accent-gold/10 transition-colors">{row.v1}</td>
                  <td className="p-4 md:p-6 text-text-muted">{row.v2}</td>
                  <td className="p-4 md:p-6 text-text-muted">{row.v3}</td>
                  <td className="p-4 md:p-6 text-text-muted">{row.v4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section className="w-full max-w-[1000px] mx-auto px-6 py-24 relative z-10 border-t border-border-color/50">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold">{t('pricingTitle', lang)}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="border border-border-color rounded-2xl p-8 bg-surface flex flex-col hover:border-text-muted transition-colors"
          >
            <h3 className="text-2xl font-display font-bold mb-2">{t('pricingFree', lang)}</h3>
            <p className="text-text-muted font-body mb-6 h-12">{t('pricingFreeDesc', lang)}</p>
            <div className="text-4xl font-bold mb-8">$0<span className="text-lg text-text-muted font-normal">{t('pricingMonth', lang)}</span></div>
            <ul className="space-y-4 mb-8 flex-grow">
              {['featFree1', 'featFree2', 'featFree3'].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-text-primary">
                  <Check className="w-5 h-5 text-accent-green flex-shrink-0" />
                  <span>{t(f, lang)}</span>
                </li>
              ))}
            </ul>
            <Link 
              to="/match-cut" 
              onClick={handleStartProject}
              className="w-full py-3 rounded-lg border border-border-color text-center font-bold hover:bg-surface-raised transition-colors"
            >
              {t('heroCTA', lang)}
            </Link>
          </motion.div>

          {/* Pro Tier */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="border border-accent-gold rounded-2xl p-8 bg-surface relative flex flex-col shadow-[0_0_30px_rgba(245,179,1,0.05)] hover:shadow-[0_0_40px_rgba(245,179,1,0.1)] transition-all"
          >
            <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-accent-gold text-bg-base text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Pro
            </div>
            <h3 className="text-2xl font-display font-bold mb-2 text-accent-gold">{t('pricingPro', lang)}</h3>
            <p className="text-text-muted font-body mb-6 h-12">{t('pricingProDesc', lang)}</p>
            <div className="text-4xl font-bold mb-8">{t('pricingProPrice', lang)}<span className="text-lg text-text-muted font-normal">{t('pricingMonth', lang)}</span></div>
            <ul className="space-y-4 mb-8 flex-grow">
              {['featPro1', 'featPro2', 'featPro3'].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-text-primary">
                  <Check className="w-5 h-5 text-accent-gold flex-shrink-0" />
                  <span>{t(f, lang)}</span>
                </li>
              ))}
            </ul>
            <Link 
              to="/pricing"
              className="w-full py-3 rounded-lg bg-accent-gold text-bg-base text-center font-bold hover:bg-yellow-400 transition-colors block"
            >
              {t('pricingUpgrade', lang) || 'Upgrade to PRO'}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className="w-full max-w-[800px] mx-auto px-6 py-24 relative z-10 border-t border-border-color/50">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold">{t('faqTitle', lang)}</h2>
        </div>
        <div className="flex flex-col">
          {[1, 2, 3, 4].map(num => (
            <FAQItem key={num} question={t(`faqQ${num}`, lang)} answer={t(`faqA${num}`, lang)} />
          ))}
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer id="footer-contact" className="w-full border-t border-border-color bg-surface pt-16 pb-32 md:pb-16 relative z-10">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          <div className="md:col-span-2 flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 opacity-80 grayscale hover:grayscale-0 transition-all" />
              <span className="font-display font-bold text-xl text-white">Animation<span className="text-accent-gold">Maker</span></span>
            </div>
            <p className="text-text-muted font-body text-sm max-w-sm mb-6 leading-relaxed">
              {t('footerDesc', lang)}
            </p>
            <a href="mailto:support@animationmaker.app" className="flex items-center gap-2 text-text-muted text-sm font-body mb-6 hover:text-white transition-colors cursor-pointer bg-zinc-800/50 px-4 py-2 rounded-full w-max">
              <Mail className="w-4 h-4 text-accent-gold" />
              <span>{t('supportEmailText', lang)} support@animationmaker.app</span>
            </a>
            <div className="text-text-muted text-sm font-mono opacity-60">
              &copy; {new Date().getFullYear()} — {t('footerRights', lang)}
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <h4 className="text-white font-bold text-lg mb-2">Legal</h4>
            <Link to="/terms" onClick={() => window.scrollTo(0,0)} className="text-text-muted hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/cookies" onClick={() => window.scrollTo(0,0)} className="text-text-muted hover:text-white transition-colors">Cookie Policy</Link>
            <Link to="/privacy" onClick={() => window.scrollTo(0,0)} className="text-text-muted hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/refund" onClick={() => window.scrollTo(0,0)} className="text-text-muted hover:text-white transition-colors">Refund Policy</Link>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <h4 className="text-white font-bold text-lg mb-2">Social</h4>
            <a href="#" className="text-text-muted hover:text-white transition-colors">Facebook</a>
            <a href="#" className="text-text-muted hover:text-white transition-colors">LinkedIn</a>
            <a href="#" className="text-text-muted hover:text-white transition-colors">Instagram</a>
            <div className="w-full max-w-[120px] h-px bg-border-color my-1"></div>
            <button 
              onClick={() => setIsCookieModalOpen(true)}
              className="text-text-muted hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2"
            >
              <Settings className="w-4 h-4" /> Cookie Settings
            </button>
          </div>
        </div>
      </footer>
      
      {/* Cookie Modal */}
      <CookieModal isOpen={isCookieModalOpen} onClose={() => setIsCookieModalOpen(false)} />

      {/* Safe Area padding for mobile */}
      <div className="pb-[env(safe-area-inset-bottom)]"></div>
    </div>
  );
};

export default Home;
