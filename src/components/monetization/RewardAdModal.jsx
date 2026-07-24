import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, AlertCircle, CheckCircle } from 'lucide-react';
import { t } from '../../lib/i18n';
import { useSettingsStore } from '../../store/settingsStore';
import AdPlaceholder from './AdPlaceholder';

const RewardAdModal = ({ isOpen, onClose, onReward, rewardAmount = 10, requiredSeconds = 15 }) => {
  const { lang } = useSettingsStore();
  const [timeLeft, setTimeLeft] = useState(requiredSeconds);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    let timer;
    if (isOpen && !isCompleted) {
      setTimeLeft(requiredSeconds);
      setShowWarning(false);
      
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCompleted(true);
            onReward(rewardAmount);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, requiredSeconds, onReward, rewardAmount, isCompleted]);

  const handleCloseAttempt = () => {
    if (!isCompleted) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
      onClose(); // Allow closing but no reward is triggered
      setTimeout(() => {
        setIsCompleted(false);
        setTimeLeft(requiredSeconds);
      }, 500);
    } else {
      onClose();
      // Reset state for next time after closing
      setTimeout(() => setIsCompleted(false), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden relative z-10 shadow-2xl flex flex-col"
        >
          {/* Header & Timer */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
            <div className="flex items-center gap-2">
              <Gift size={20} className={isCompleted ? "text-green-500" : "text-[#F5B301]"} />
              <span className="font-bold text-white">
                {isCompleted ? t('adRewardSuccess', lang) || "Reward Unlocked!" : t('watchingAd', lang) || "Watching Advertisement..."}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {!isCompleted ? (
                <div className="flex items-center gap-2 bg-[#F5B301]/10 text-[#F5B301] px-3 py-1.5 rounded-full font-mono font-bold text-sm border border-[#F5B301]/20">
                  <span className="w-2 h-2 rounded-full bg-[#F5B301] animate-pulse"></span>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full font-bold text-sm border border-green-500/20">
                  <CheckCircle size={16} />
                  +{rewardAmount} {t('rewardPoints', lang) || "Points"}
                </div>
              )}
              
              <button 
                onClick={handleCloseAttempt}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Ad Container / Simulated Video */}
          <div className="p-1 sm:p-6 flex-1 flex flex-col items-center justify-center min-h-[300px] bg-black relative">
            {/* Mock Video Player UI for Testing */}
            <div className="w-full h-[250px] sm:h-[300px] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 flex items-center justify-center group">
              {/* Background Animation */}
              <div className="absolute inset-0 opacity-30 flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-[#F5B301] to-purple-600 blur-[40px]"
                />
              </div>

              <div className="relative z-10 flex flex-col items-center text-center px-4">
                <div className="w-16 h-16 bg-[#F5B301] rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(245,179,1,0.5)]">
                  <Gift size={32} className="text-black" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Test Reklamı (Simülasyon)</h3>
                <p className="text-zinc-400 text-sm max-w-xs">
                  Ödülü kazanmak için sürenin dolmasını bekleyin. Canlı ortamda burada gerçek reklam gösterilecektir.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 h-1.5 bg-zinc-800 w-full">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: isCompleted ? "100%" : `${((requiredSeconds - timeLeft) / requiredSeconds) * 100}%` }}
                  className="h-full bg-[#F5B301]"
                />
              </div>
            </div>

            {/* Warning Message */}
            <AnimatePresence>
              {showWarning && !isCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-6 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium z-20"
                >
                  <AlertCircle size={16} />
                  Lütfen sürenin bitmesini bekleyin!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Footer Action */}
          {isCompleted && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
              <button
                onClick={() => {
                  onClose();
                  setTimeout(() => setIsCompleted(false), 500);
                }}
                className="px-6 py-2 bg-[#F5B301] hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors"
              >
                Kapat ve Puanı Al
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RewardAdModal;
