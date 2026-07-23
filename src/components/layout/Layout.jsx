import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Menu, X, ChevronsDown, ChevronsUp, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsModal from '../modals/SettingsModal';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

const Layout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useSettingsStore();
  const scrollRef = useRef(null);

  const isToolPage = location.pathname === '/match-cut';
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(isToolPage);

  // Auto-collapse header only when navigating to actual tool pages
  useEffect(() => {
    setIsHeaderCollapsed(location.pathname === '/match-cut');
  }, [location.pathname]);

  // Scroll to top on pathname change
  useEffect(() => {
    if (scrollRef.current && !location.hash) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  // Universal scroll tracking using capture phase to catch scroll from ANY element
  useEffect(() => {
    const handleUniversalScroll = (e) => {
      let scrollTop = 0;
      
      // If the scroll event came from the document/window
      if (e.target === document || e.target === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
      } else {
        // If it came from a specific scrollable div
        scrollTop = e.target.scrollTop;
      }

      if (scrollTop !== undefined) {
        setIsScrolled(scrollTop > 10);
        setShowScrollTop(scrollTop > 300);
      }
    };

    // 'true' enables the capture phase, catching all nested scrolls
    window.addEventListener('scroll', handleUniversalScroll, true);
    return () => window.removeEventListener('scroll', handleUniversalScroll, true);
  }, []);

  // Keep handleScroll for the active hash logic since it requires scrollHeight
  const handleScroll = (e) => {
    const target = e.currentTarget;
    if (!target) return;
    const { scrollTop, scrollHeight, clientHeight } = target;

    if (location.pathname === '/') {
      if (scrollHeight - scrollTop - clientHeight < 150) {
        setActiveHash('contact');
      } else {
        setActiveHash('');
      }
    } else {
      setActiveHash('');
    }
  };

  const scrollToTop = () => {
    // 1. Scroll olan asıl elementi bul
    const containers = [
      scrollRef.current,
      document.documentElement,
      document.body,
      document.querySelector('.flex-grow') // Home.jsx veya diğer sayfalar için
    ];

    let scrolledElement = null;
    for (const el of containers) {
      if (el && el.scrollTop > 5) {
        scrolledElement = el;
        break;
      }
    }

    if (!scrolledElement && window.scrollY > 5) {
      scrolledElement = window;
    }

    // 2. Elementi yumuşak kaydır
    if (scrolledElement) {
      if (scrolledElement === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scrolledElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // 3. Tarayıcı native smooth scroll'u reddederse diye (Safari/iOS bug) 400ms sonra kesin sıfırla
      setTimeout(() => {
        if (scrolledElement === window) {
          window.scrollTo(0, 0);
        } else {
          scrolledElement.scrollTop = 0;
        }
      }, 400);
    } else {
      // Bulamazsa her şeyi zorla sıfırla
      window.scrollTo(0, 0);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }

    if (location.hash) {
      window.history.replaceState(null, '', location.pathname);
    }
  };

  const handleLinkClick = (e, path) => {
    if (path === '/' && location.pathname === '/') {
      e.preventDefault();
      scrollToTop();
      setActiveHash('');
    }
  };

  return (
    <div className={`h-[100dvh] w-full bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden selection:bg-yellow-500/30 ${lang === 'ar' ? 'dir-rtl' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Dynamic Background Noise / Gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950"></div>
      
      {/* Floating Toggle Button (visible only when header is collapsed) */}
      <AnimatePresence>
        {isHeaderCollapsed && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsHeaderCollapsed(false)}
            className="fixed top-4 right-4 z-50 flex items-center justify-center gap-1.5 px-4 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-full text-zinc-400 hover:text-white shadow-lg hover:bg-zinc-800 transition-colors text-xs font-bold uppercase tracking-wider"
            title="Show Menu"
          >
            <ChevronsDown size={16} /> {t('layoutMenu', lang)}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar (Fixed and always mounted, smoothly animating Y-axis) */}
      <motion.header
        initial={false}
        animate={{ y: isHeaderCollapsed ? '-100%' : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-[env(safe-area-inset-top)] pointer-events-none"
      >
        <div className={`pointer-events-auto flex items-center justify-between transition-all duration-500 w-full overflow-hidden ${
          isScrolled 
            ? 'max-w-[92vw] sm:max-w-[850px] mt-3 h-14 px-4 sm:px-6 bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 shadow-xl rounded-full' 
            : 'max-w-full sm:max-w-[1600px] mt-0 h-16 sm:h-20 px-4 sm:px-8 lg:px-12 bg-transparent border-transparent rounded-none'
        }`}>
          <div className="flex items-center">
            {/* Logo */}
            <Link to="/" onClick={(e) => handleLinkClick(e, '/')} className="flex items-center space-x-2 group">
              <img src="/logo.png" alt="AnimationMaker Logo" className="h-7 sm:h-8 w-auto object-contain group-hover:scale-105 transition-transform" />
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white hidden sm:block">
                Animation<span className="text-yellow-400">Maker</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Try Now Button */}
            {!isToolPage && (
              <Link
                to="/match-cut"
                className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#F5B301] hover:bg-yellow-400 text-black font-bold rounded-full text-xs sm:text-sm shadow-[0_0_15px_rgba(245,179,1,0.2)] hover:shadow-[0_0_25px_rgba(245,179,1,0.6)] transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {t('tryNowButton', lang)}
              </Link>
            )}

            {/* Collapse Button (Only on tool pages) */}
            {isToolPage && (
              <button
                onClick={() => setIsHeaderCollapsed(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
                title="Collapse Menu"
              >
                <ChevronsUp size={20} />
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
              title={t('settingsTitle', lang)}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area (Smoothly pads top when header is visible to avoid layout jump) */}
      <motion.div 
        ref={scrollRef}
        onScroll={handleScroll}
        initial={false}
        animate={{ paddingTop: isHeaderCollapsed ? 'env(safe-area-inset-top)' : 'calc(4rem + env(safe-area-inset-top))' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 flex flex-col relative z-10 overflow-x-hidden overflow-y-auto"
      >
        {/* Kesin Scroll hedefleri için gizli anchor */}
        <div id="top-anchor" className="absolute top-0 left-0 w-full h-px opacity-0 pointer-events-none -mt-[4rem]"></div>
        
        <Outlet />
      </motion.div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 w-12 h-12 bg-zinc-800 hover:bg-accent-gold text-white hover:text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors focus:outline-none focus:ring-2 focus:ring-accent-gold"
            title="Scroll to Top"
          >
            <ArrowUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Layout;
