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
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={handleBackdropClick}
          ></motion.div>
          
          {/* Animated Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md z-10"
            data-modal="true"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-[#F5B301]/20 to-[#FF9D00]/10 rounded-[2rem] blur-xl opacity-50 pointer-events-none"></div>
            
            {/* Modal Box */}
            <div className="bg-zinc-950/80 backdrop-blur-3xl border border-zinc-800/60 rounded-[1.5rem] shadow-2xl overflow-hidden relative">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
                <h2 className="text-xl font-bold text-white tracking-tight">{t('settingsTitle', lang)}</h2>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Body */}
              <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* Language Selection */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{t('settingsLanguage', lang)}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {languages.map((l) => {
                      const isActive = lang === l.code;
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          key={l.code}
                          onClick={() => setSetting('lang', l.code)}
                          className={`flex items-center justify-center py-3 px-4 rounded-xl border transition-colors ${
                            isActive 
                              ? 'bg-gradient-to-r from-[#F5B301] to-[#FF9D00] border-transparent text-black font-bold shadow-[0_0_15px_rgba(245,179,1,0.2)]' 
                              : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          {l.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Theme Selection (Disabled for now) */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{t('settingsTheme', lang)}</label>
                  <div className="grid grid-cols-1">
                     <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 flex items-center justify-between opacity-60 cursor-not-allowed">
                       <span className="text-zinc-400 text-sm font-medium">{t('settingsThemeInfo', lang)}</span>
                       <div className="w-12 h-6 bg-zinc-800 rounded-full relative border border-zinc-700">
                         <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-600 rounded-full"></div>
                       </div>
                     </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-end">
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="px-8 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-xl transition-colors shadow-lg"
                >
                  {t('settingsDone', lang)}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
