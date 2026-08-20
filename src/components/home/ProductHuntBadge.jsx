import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { t } from '../../lib/i18n';
import { useSettingsStore } from '../../store/settingsStore';

export default function ProductHuntBadge() {
  const { lang } = useSettingsStore();

  return (
    <motion.a
      href="https://www.producthunt.com"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#16161A]/90 hover:bg-[#1D1D22] border border-[#2A2A30] hover:border-[#DA552F]/60 text-white shadow-lg transition-all duration-300 group"
    >
      {/* Product Hunt Official P Icon */}
      <div className="w-7 h-7 rounded-full bg-[#DA552F] flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
        P
      </div>

      <div className="flex flex-col text-left">
        <span className="font-mono text-[10px] font-bold text-[#DA552F] tracking-wider uppercase leading-none mb-0.5">
          {t('phBadgeTag', lang) || 'PRODUCT HUNT'}
        </span>
        <span className="font-display font-semibold text-xs sm:text-sm text-zinc-100 group-hover:text-white flex items-center gap-1">
          {t('phBadgeText', lang) || 'Featured on Product Hunt'}
          <ExternalLink size={11} className="text-zinc-500 group-hover:text-zinc-300" />
        </span>
      </div>
    </motion.a>
  );
}
