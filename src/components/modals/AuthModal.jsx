import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogIn, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { t } from '../../lib/i18n';

const AuthModal = () => {
  const { authModalOpen, closeAuthModal, pendingAction, loginWithGoogle } = useAuthStore();
  const { lang } = useSettingsStore();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const isRtl = lang === 'ar';

  if (!authModalOpen) return null;

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      if (pendingAction?.type === 'NAVIGATE' && typeof window !== 'undefined') {
        sessionStorage.setItem('redirect_after_login', pendingAction.payload);
      }
      await loginWithGoogle();
      handleAction();
    } catch (err) {
      // Sadece konsola yazdır, popup kapatıldıysa hata gösterme
      console.log("Giriş işlemi iptal edildi veya hata oluştu.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestContinue = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('guest_mode_enabled', 'true');
    }
    handleAction();
  };

  const handleAction = () => {
    if (pendingAction?.type === 'NAVIGATE') {
      navigate(pendingAction.payload);
    }
    closeAuthModal();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-md bg-surface border border-border-color rounded-2xl shadow-2xl p-6 overflow-hidden ${isRtl ? 'dir-rtl text-right' : 'text-left'}`}
        >
          <button 
            onClick={closeAuthModal}
            className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} text-text-muted hover:text-white transition-colors`}
          >
            <X size={24} />
          </button>

          <div className="mb-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-bg-base border border-border-color rounded-full flex items-center justify-center mb-4 text-accent-gold shadow-lg shadow-accent-gold/20">
              <LogIn size={28} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">{t('saveProgressTitle', lang) || "Çalışmalarınızı Kaybetmeyin!"}</h2>
            <p className="text-text-muted text-sm leading-relaxed">
              {t('saveProgressDesc', lang) || "Google ile saniyeler içinde giriş yaparak ürettiğiniz videoların ayarlarını kaydedin ve reklam ödülleri kazanın."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full flex items-center justify-center gap-3 bg-white text-black py-3 px-4 rounded-xl font-bold transition-colors ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-200 cursor-pointer'}`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              {isLoggingIn ? "Bağlanıyor..." : (t('loginGoogle', lang) || "Google ile Giriş Yap")}
            </button>

            <button
              onClick={handleGuestContinue}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-text-muted hover:text-white hover:bg-bg-base transition-colors cursor-pointer"
            >
              {t('continueAsGuest', lang) || "Giriş Yapmadan Devam Et"}
              <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;
