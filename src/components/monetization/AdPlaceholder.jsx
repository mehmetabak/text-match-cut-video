import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../lib/i18n';

const AdPlaceholder = ({ className = '' }) => {
  const { lang } = useSettingsStore();
  return (
    <div className={`border border-dashed border-zinc-700 bg-black/40 rounded-xl flex flex-col items-center justify-center p-6 text-zinc-500 overflow-hidden relative ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-zinc-800/10 to-transparent"></div>
      <span className="text-sm font-semibold tracking-wider uppercase mb-1">{t('adSpace', lang)}</span>
      <span className="text-xs text-zinc-600 text-center">{t('adDesc', lang)}</span>
    </div>
  );
};

export default AdPlaceholder;
