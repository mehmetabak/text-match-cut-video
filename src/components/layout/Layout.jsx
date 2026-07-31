import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Menu, X, ChevronsDown, ChevronsUp, ArrowUp, User, LogOut, Folder, Star, Coins, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsModal from '../modals/SettingsModal';
import AuthModal from '../modals/AuthModal';
import RewardAdModal from '../monetization/RewardAdModal';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { t } from '../../lib/i18n';

const Layout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPointsDropdownOpen, setIsPointsDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const lang = useSettingsStore((state) => state.lang);
  const isHeaderCollapsed = useSettingsStore((state) => state.isHeaderCollapsed);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const logout = useAuthStore((state) => state.logout);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isRewardModalOpen = useAuthStore((state) => state.isRewardModalOpen);
  const setRewardModalOpen = useAuthStore((state) => state.setRewardModalOpen);
  const earnRewardPoints = useAuthStore((state) => state.earnRewardPoints);

  const scrollRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const pointsDropdownRef = useRef(null);

  const isToolPage = (['/match-cut', '/effects/ken-burns', '/effects/vhs-tape'].includes(location.pathname));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (pointsDropdownRef.current && !pointsDropdownRef.current.contains(event.target)) {
        setIsPointsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Sadece araç içindeyken (match-cut) üst barın gizlenme/daralma (collapse) özelliği aktif olabilir.
    // Ana sayfa, Profil veya Araçlar menüsüne geçildiğinde üst bar KESİNLİKLE görünür (açık) olmalıdır.
    if ((['/match-cut', '/effects/ken-burns', '/effects/vhs-tape'].includes(location.pathname))) {
      setSetting('isHeaderCollapsed', true);
    } else {
      setSetting('isHeaderCollapsed', false);
    }
  }, [location.pathname, setSetting]);

  useEffect(() => {
    if (scrollRef.current && !location.hash) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const handleUniversalScroll = (e) => {
      // Modalların (Settings vb.) içindeki scroll hareketlerini yoksay
      if (e.target && e.target.closest && e.target.closest('[data-modal="true"]')) {
        return;
      }

      // Güvenilir genel scroll pozisyonu (window veya document üzerinden)
      let scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

      // Eğer spesifik bir element scroll ediliyorsa ve sayfanın büyük bir kısmını kaplıyorsa
      if (e.target && e.target.scrollTop !== undefined) {
        if (
          e.target === document ||
          e.target === document.documentElement ||
          e.target === document.body ||
          e.target === scrollRef.current ||
          (e.target.clientHeight && e.target.clientHeight >= window.innerHeight * 0.7) // Sayfanın %70'inden büyük olan scroll container'ları ana sayfa scroller'ı kabul et
        ) {
          scrollTop = Math.max(scrollTop, e.target.scrollTop);
        }
      }

      setIsScrolled(scrollTop > 20);
      setShowScrollTop(scrollTop > 300);
    };

    // passive: true performansı artırır ve scroll jank'i engeller
    window.addEventListener('scroll', handleUniversalScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleUniversalScroll, { capture: true });
  }, []);

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
    const containers = [
      scrollRef.current,
      document.documentElement,
      document.body,
      document.querySelector('.flex-grow')
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

    if (scrolledElement) {
      if (scrolledElement === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scrolledElement.scrollTo({ top: 0, behavior: 'smooth' });
      }

      setTimeout(() => {
        if (scrolledElement === window) {
          window.scrollTo(0, 0);
        } else {
          scrolledElement.scrollTop = 0;
        }
      }, 400);
    } else {
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
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950"></div>

      <AnimatePresence>
        {isHeaderCollapsed && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSetting('isHeaderCollapsed', false)}
            className="fixed top-4 right-4 z-50 flex items-center justify-center gap-1.5 px-4 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-full text-zinc-400 hover:text-white shadow-lg hover:bg-zinc-800 transition-colors text-xs font-bold uppercase tracking-wider"
            title="Show Menu"
          >
            <ChevronsDown size={16} /> {t('layoutMenu', lang)}
          </motion.button>
        )}
      </AnimatePresence>

      <motion.header
        initial={false}
        animate={{ y: isHeaderCollapsed ? '-100%' : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-[env(safe-area-inset-top)] pointer-events-none"
      >
        <div className={`pointer-events-auto flex items-center justify-between transition-all duration-500 w-full ${isScrolled
          ? 'max-w-[92vw] sm:max-w-[850px] mt-3 h-14 px-4 sm:px-6 bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 shadow-xl rounded-full'
          : 'max-w-full sm:max-w-[1600px] mt-0 h-16 sm:h-20 px-4 sm:px-8 lg:px-12 bg-transparent border-transparent rounded-none'
          }`}>
          <div className="flex items-center">
            <Link to="/" onClick={(e) => handleLinkClick(e, '/')} className="flex items-center space-x-2 group">
              <img src="/logo.png" alt="AnimationMaker Logo" className="h-7 sm:h-8 w-auto object-contain group-hover:scale-105 transition-transform" />
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white hidden sm:block">
                Animation<span className="text-yellow-400">Maker</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Tools Link */}
            <Link
              to="/tools"
              title={t('toolsMenu', lang)}
              className={`flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full font-bold text-sm transition-all ${location.pathname === '/tools'
                ? 'bg-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
            >
              <LayoutGrid size={16} className="shrink-0" />
              <span className="hidden sm:inline-block">{t('toolsMenu', lang) || 'Tools'}</span>
            </Link>

            {/* Pricing Link */}
            <Link
              to="/pricing"
              title={t('pricingTitle', lang) || 'Pricing'}
              className={`flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full font-bold text-sm transition-all ${location.pathname === '/pricing'
                ? 'bg-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
            >
              <Star size={16} className="shrink-0 text-purple-400" />
              <span className="hidden sm:inline-block text-purple-400">{t('pricingPro', lang) || 'Pro'}</span>
            </Link>

            {/* Points Indicator Button (always visible) */}
            {!loading && (
              <div className="relative" ref={pointsDropdownRef}>
                <button
                  onClick={() => user ? setIsPointsDropdownOpen(!isPointsDropdownOpen) : openAuthModal({ type: 'SIGN_IN' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5B301]/10 hover:bg-[#F5B301]/20 border border-[#F5B301]/20 rounded-full text-[#F5B301] font-bold text-sm transition-all shadow-[0_0_10px_rgba(245,179,1,0.1)] group"
                  title={t('earnRewardsTitle', lang)}
                >
                  <Coins size={14} className="group-hover:rotate-12 transition-transform" />
                  {user ? (user.adRewardPoints || 0) : 0}
                </button>

                <AnimatePresence>
                  {isPointsDropdownOpen && user && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95, transformOrigin: 'top right' }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute right-0 mt-3 w-[260px] max-w-[90vw] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] py-3 z-50 overflow-hidden"
                    >
                      <div className="px-5 py-2 mb-2 flex items-center gap-3 text-white">
                        <div className="w-10 h-10 rounded-full bg-[#F5B301]/10 flex items-center justify-center text-[#F5B301]">
                          <Coins size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('totalPoints', lang) || 'Toplam Puan'}</span>
                          <span className="font-extrabold text-[#F5B301] text-xl leading-none">{user.adRewardPoints || 0}</span>
                        </div>
                      </div>

                      <div className="px-3 pt-2 mt-2 border-t border-zinc-800/50">
                        <button
                          onClick={() => { setIsPointsDropdownOpen(false); navigate('/account'); }}
                          className="w-full relative group overflow-hidden bg-zinc-900 hover:bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-300 border border-zinc-800 hover:border-zinc-700 cursor-pointer"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-[#F5B301]/0 via-[#F5B301]/5 to-[#F5B301]/0 group-hover:translate-x-full transition-transform duration-1000 -skew-x-12"></div>
                          <span className="flex items-center gap-2 text-sm font-bold text-zinc-200 group-hover:text-white transition-colors relative z-10">
                            <Star size={16} className="text-[#F5B301] group-hover:scale-110 transition-transform" />
                            {t('earnMorePoints', lang) || 'Puan Kazan'}
                          </span>
                          <div className="bg-[#F5B301]/10 text-[#F5B301] px-2 py-0.5 rounded-full text-xs font-bold relative z-10 group-hover:bg-[#F5B301]/20 transition-colors">
                            {t('goToAccount', lang) || 'Hesaba Git'}
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {loading ? (
              <div className="w-8 h-8 sm:w-28 sm:h-10 bg-zinc-800/50 animate-pulse rounded-full"></div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 hover:bg-zinc-800 rounded-full border border-zinc-800 transition-colors cursor-pointer"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} referrerPolicy="no-referrer" alt="Profile" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-gold text-black flex items-center justify-center font-bold text-xs">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span className="text-sm font-medium hidden md:block max-w-[100px] truncate">{user.displayName || user.email?.split('@')[0]}</span>
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] py-2 z-50"
                      >
                        <div className="px-4 py-2 border-b border-zinc-800/50 mb-2">
                          <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
                          <p className="text-xs text-text-muted truncate">{user.email}</p>
                        </div>

                        <div className="px-4 py-2 flex items-center gap-2 text-accent-gold border-b border-zinc-800/50 mb-2">
                          <Star size={16} />
                          <span className="text-sm font-bold">{user.adRewardPoints || 0} {t('rewardPoints', lang) || 'Points'}</span>
                        </div>

                        <button onClick={() => { setIsProfileOpen(false); navigate('/account'); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
                          <User size={16} /> {t('accountMenu', lang) || 'Account'}
                        </button>
                        <button onClick={() => { setIsProfileOpen(false); navigate('/projects'); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer border-b border-zinc-800/50 pb-3 mb-1">
                          <Folder size={16} /> {t('myProjects', lang) || 'Projelerim'}
                        </button>
                        <button onClick={() => { setIsProfileOpen(false); logout(); navigate('/'); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors cursor-pointer">
                          <LogOut size={16} /> {t('logout', lang) || 'Çıkış Yap'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <>
                {!isToolPage ? (
                  <button
                    onClick={() => openAuthModal({ type: 'NAVIGATE', payload: '/tools' })}
                    className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#F5B301] hover:bg-yellow-400 text-black font-bold rounded-full text-xs sm:text-sm shadow-[0_0_15px_rgba(245,179,1,0.2)] hover:shadow-[0_0_25px_rgba(245,179,1,0.6)] transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    {t('tryNowButton', lang)}
                  </button>
                ) : (
                  <button
                    onClick={() => openAuthModal()}
                    className="px-4 py-1.5 sm:px-5 sm:py-2 bg-white hover:bg-gray-100 text-black font-bold rounded-full text-xs sm:text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.6)] transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 hidden sm:block" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t('loginGoogle', lang) || "Giriş Yap"}
                  </button>
                )}
              </>
            )}

            {isToolPage && (
              <button
                onClick={() => setSetting('isHeaderCollapsed', true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
                title="Collapse Menu"
              >
                <ChevronsUp size={20} />
              </button>
            )}

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

      <motion.div
        ref={scrollRef}
        onScroll={handleScroll}
        initial={false}
        animate={{ paddingTop: isHeaderCollapsed ? 'env(safe-area-inset-top)' : 'calc(4rem + env(safe-area-inset-top))' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 flex flex-col relative z-10 overflow-x-hidden overflow-y-auto"
      >
        <div id="top-anchor" className="absolute top-0 left-0 w-full h-px opacity-0 pointer-events-none -mt-[4rem]"></div>

        <Outlet />
      </motion.div>

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
      <RewardAdModal
        isOpen={isRewardModalOpen}
        onClose={() => setRewardModalOpen(false)}
        onReward={(points) => earnRewardPoints(points)}
      />
      <AuthModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Layout;
