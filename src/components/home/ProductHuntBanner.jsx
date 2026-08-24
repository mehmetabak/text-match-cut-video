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
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="w-full bg-gradient-to-r from-[#16161A] via-[#1D1D24] to-[#16161A] border-b border-accent-gold/40 text-white relative z-50 overflow-hidden shadow-lg"
      >
        <div className="max-w-[1280px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-body">
          {/* Left Welcome Tag */}
          <div className="flex items-center gap-2.5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#DA552F] text-white flex items-center justify-center font-bold text-xs shadow-md">
              P
            </span>
            <span className="font-semibold text-zinc-100">
              {t('phBannerWelcome', lang) || 'Welcome Product Hunt Hunters! 👋'}
            </span>
            <span className="hidden md:inline-block text-zinc-400">
              {t('phBannerDesc', lang) || 'Enjoy full access to our kinetic typography & video effects studio.'}
            </span>
          </div>

          {/* Right Action & Dismiss */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="bg-accent-gold/20 text-accent-gold border border-accent-gold/30 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full">
              LAUNCH DAY ACCESS
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
