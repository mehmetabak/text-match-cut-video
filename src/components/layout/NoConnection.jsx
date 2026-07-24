import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

const NoConnection = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { lang } = useSettingsStore();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      setIsOffline(false);
    } else {
      // Simulate checking animation
      const btn = document.getElementById('retry-btn');
      if(btn) {
        btn.classList.add('animate-spin');
        setTimeout(() => btn.classList.remove('animate-spin'), 1000);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          <motion.div 
            className="relative z-10 max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl overflow-hidden"
          >
            {/* Warning Tape Decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>

            <div className="flex justify-center mb-6 relative">
              <motion.div 
                animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20"
              >
                <WifiOff size={40} className="text-red-500" />
              </motion.div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              {t('offlineTitle', lang) || "No Connection"}
            </h2>
            <p className="text-zinc-400 font-body mb-8">
              {t('offlineDesc', lang) || "It seems you've lost your internet connection. Please check your network and try again."}
            </p>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-100 text-zinc-900 font-bold rounded-xl hover:bg-white transition-colors"
            >
              <RefreshCw id="retry-btn" size={20} />
              {t('retryConnection', lang) || "Retry Connection"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NoConnection;
