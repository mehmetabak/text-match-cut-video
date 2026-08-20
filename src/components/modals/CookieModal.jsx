import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Activity, Cookie } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

const CookieModal = ({ isOpen, onClose }) => {
  const { lang, cookieConsent, setSetting } = useSettingsStore();
  const [analytics, setAnalytics] = useState(cookieConsent?.analytics ?? true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Sync local state when opened
      setAnalytics(cookieConsent?.analytics ?? true);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, cookieConsent]);

  const handleSave = () => {
    setSetting('cookieConsent', { essential: true, analytics, hasConsented: true });
    onClose();
  };

  const handleAcceptAll = () => {
    setSetting('cookieConsent', { essential: true, analytics: true, hasConsented: true });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10"
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <Cookie className="text-accent-gold w-6 h-6" />
                <h2 className="text-xl font-bold text-white tracking-tight">{t('cookieTitle', lang)}</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <p className="text-zinc-400 text-sm leading-relaxed">
                {t('cookieDesc', lang)}
              </p>

              {/* Essential Cookies */}
              <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 flex items-start gap-4 opacity-70">
                <Shield className="w-5 h-5 text-zinc-400 mt-0.5 shrink-0" />
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{t('cookieEssential', lang)}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                      {t('cookieAlwaysActive', lang)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{t('cookieEssentialDesc', lang)}</p>
                </div>
              </div>

              {/* Analytics & Error Cookies */}
              <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 flex items-start gap-4 hover:border-zinc-700 transition-colors">
                <Activity className={`w-5 h-5 mt-0.5 shrink-0 transition-colors ${analytics ? 'text-accent-gold' : 'text-zinc-500'}`} />
                <div className="flex-grow cursor-pointer" onClick={() => setAnalytics(!analytics)}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{t('cookieAnalytics', lang)}</h3>
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${analytics ? 'bg-accent-gold' : 'bg-zinc-700'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${analytics ? 'translate-x-4' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{t('cookieAnalyticsDesc', lang)}</p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors border border-zinc-700 text-sm"
              >
                {t('cookieSave', lang)}
              </button>
              <button 
                onClick={handleAcceptAll}
                className="px-6 py-2.5 bg-gradient-to-r from-accent-gold to-[#FF9D00] text-black font-bold rounded-lg transition-transform hover:scale-105 text-sm"
              >
                {t('cookieAcceptAll', lang)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CookieModal;
