import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

const SettingsModal = ({ isOpen, onClose }) => {
  const { lang, setSetting } = useSettingsStore();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'zh', label: '中文' },
    { code: 'ar', label: 'العربية' },
    { code: 'ko', label: '한국어' },
    { code: 'ja', label: '日本語' },
    { code: 'id', label: 'Bahasa Indonesia' },
    { code: 'th', label: 'ไทย' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ru', label: 'Русский' },
    { code: 'pt', label: 'Português' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Animated Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          ></motion.div>
          
          {/* Animated Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white tracking-tight">{t('settingsTitle', lang)}</h2>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-gold"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-300">{t('settingsLanguage', lang)}</label>
                <div className="grid grid-cols-2 gap-3">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setSetting('lang', l.code)}
                      className={`flex items-center justify-center py-2.5 px-4 rounded-xl border transition-all ${
                        lang === l.code 
                          ? 'bg-[#F5B301]/10 border-[#F5B301]/50 text-[#F5B301] shadow-[0_0_10px_rgba(245,179,1,0.1)]' 
                          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-300">{t('settingsTheme', lang)}</label>
                <div className="grid grid-cols-1">
                   <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 flex items-center justify-between opacity-50 cursor-not-allowed">
                     <span className="text-zinc-400 text-sm">{t('settingsThemeInfo', lang)}</span>
                     <div className="w-10 h-6 bg-zinc-700 rounded-full relative">
                       <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-500 rounded-full"></div>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-accent-gold to-[#FF9D00] hover:scale-105 text-bg-base font-bold rounded-lg transition-transform focus:outline-none focus:ring-2 focus:ring-accent-gold focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-md"
              >
                {t('settingsDone', lang)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
