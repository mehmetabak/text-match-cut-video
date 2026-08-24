import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

export default function ProductHuntBanner() {
  const { lang } = useSettingsStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    if (sessionStorage.getItem('ph_banner_dismissed') === 'true') {
      return;
    }

    // Check URL parameters for Product Hunt referral
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isFromPH = 
        urlParams.get('ref') === 'producthunt' ||
        urlParams.get('utm_source') === 'producthunt' ||
        urlParams.get('utm_campaign')?.includes('product-hunt') ||
        urlParams.get('utm_campaign')?.includes('producthunt') ||
        urlParams.get('utm_campaign')?.includes('animation-maker') ||
        urlParams.get('source') === 'producthunt';

      if (isFromPH) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    try {
      sessionStorage.setItem('ph_banner_dismissed', 'true');
    } catch (e) {}
  };

  if (!isVisible || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[900px] mx-auto px-4 pt-20 sm:pt-24 pb-2 relative z-30"
      >
        <div className="w-full bg-[#16161A]/95 backdrop-blur-md border border-[#DA552F]/40 shadow-[0_8px_30px_rgba(218,85,47,0.15)] text-white rounded-2xl px-4 sm:px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          {/* Left: Product Hunt Icon & Welcome */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#DA552F] text-white font-black text-sm flex items-center justify-center shadow-md flex-shrink-0">
              P
            </div>
            <div className="flex flex-col text-left min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xs sm:text-sm text-zinc-100 truncate">
                  {t('phBannerWelcome', lang) || 'Welcome Product Hunt Community! 👋'}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 bg-[#DA552F]/20 text-[#DA552F] border border-[#DA552F]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  <Sparkles size={10} /> SPECIAL ACCESS
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-zinc-400 font-body truncate">
                {t('phBannerDesc', lang) || 'Create viral kinetic typography & match cut videos in seconds with full access.'}
              </span>
            </div>
          </div>

          {/* Right: Launch Tag & Dismiss */}
          <div className="flex items-center gap-2.5 ml-auto flex-shrink-0">
            <span className="sm:hidden bg-[#DA552F]/20 text-[#DA552F] border border-[#DA552F]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              SPECIAL ACCESS
            </span>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
