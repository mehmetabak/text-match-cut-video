import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { t } from '../lib/i18n';

const LegalPage = ({ title }) => {
  const { lang } = useSettingsStore();
  const navigate = useNavigate();
  const isRtl = lang === 'ar';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className={`w-full flex-grow flex flex-col items-center bg-bg-base text-text-primary px-6 py-10 md:py-16 ${isRtl ? 'dir-rtl text-right' : 'text-left'}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mx-auto relative"
      >
        <button 
          onClick={() => navigate('/')}
          className="absolute -top-2 right-0 md:-right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors focus:outline-none"
          title="Kapat"
        >
          <X size={24} />
        </button>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-8 text-center pr-10">{title}</h1>
        <div className="space-y-6 text-text-muted font-body leading-relaxed bg-surface border border-border-color p-8 md:p-12 rounded-2xl shadow-xl">
          <p className="text-sm font-mono opacity-60 uppercase tracking-widest border-b border-border-color pb-4 mb-8">
            {t('legalLastUpdated', lang)} {new Date().toLocaleDateString()}
          </p>
          <p>
            {t('legalIntroText', lang)}
          </p>
          <h2 className="text-2xl font-bold text-white mt-10 mb-4">{t('legalDataTitle', lang)}</h2>
          <p>
            {t('legalDataText', lang)}
          </p>
          <h2 className="text-2xl font-bold text-white mt-10 mb-4">{t('legalTermsTitle', lang)}</h2>
          <p>
            {t('legalTermsText', lang)}
          </p>
          <h2 className="text-2xl font-bold text-white mt-10 mb-4">{t('legalContactTitle', lang)}</h2>
          <p>
            {t('legalContactText', lang)}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LegalPage;
