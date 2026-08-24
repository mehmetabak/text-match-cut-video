import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
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
        // Small entrance delay for natural feel
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 600);
        return () => clearTimeout(timer);
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
      <motion.aside
        aria-label="Product Hunt Welcome"
        initial={{ opacity: 0, y: 35, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 35, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="fixed bottom-5 right-4 sm:right-6 z-50 w-[calc(100%-2rem)] sm:w-auto sm:max-w-md pointer-events-auto select-none"
      >
        <div className="bg-[#131317]/95 backdrop-blur-xl border border-zinc-800/90 hover:border-zinc-700 shadow-[0_16px_40px_rgba(0,0,0,0.65),0_0_20px_rgba(218,85,47,0.12)] text-white rounded-2xl p-3.5 sm:p-4 flex items-start gap-3.5 relative overflow-hidden group">
          {/* Subtle Accent Glow Top Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#DA552F] to-transparent opacity-80"></div>

          {/* Product Hunt Brand Icon */}
          <div className="w-9 h-9 rounded-xl bg-[#DA552F] text-white font-black text-base flex items-center justify-center shadow-lg shadow-[#DA552F]/30 flex-shrink-0 mt-0.5">
            P
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-100 leading-snug">
                {t('phToastTitle', lang) || 'Welcome from Product Hunt! 👋'}
              </h4>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 font-body leading-relaxed">
              {t('phToastDesc', lang) || 'Enjoy full access to all 15+ video effects & Match Cut studio.'}
            </p>
          </div>

          {/* Close Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
