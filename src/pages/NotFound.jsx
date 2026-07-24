import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../lib/i18n';

const NotFound = () => {
  const { lang } = useSettingsStore();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-lg w-full text-center space-y-8"
      >
        <div className="relative inline-block">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-9xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500"
          >
            404
          </motion.h1>
          <div className="absolute -inset-4 bg-accent-gold/10 blur-2xl -z-10 rounded-full opacity-50"></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white">
            {t('pageNotFoundTitle', lang) || "Page Not Found"}
          </h2>
          <p className="text-zinc-400 font-body text-lg">
            {t('pageNotFoundDesc', lang) || "The page you're looking for doesn't exist or has been moved."}
          </p>
        </div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-block"
        >
          <Link
            to="/"
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-accent-gold to-[#FF9D00] text-bg-base font-bold rounded-xl hover:shadow-[0_0_20px_rgba(245,179,1,0.3)] transition-all"
          >
            <Home size={20} />
            {t('backToHome', lang) || "Back to Home"}
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
