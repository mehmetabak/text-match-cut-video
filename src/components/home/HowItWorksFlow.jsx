import React from 'react';
import { motion } from 'framer-motion';
import { Type, Sliders, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { t } from '../../lib/i18n';
import { useSettingsStore } from '../../store/settingsStore';

export default function HowItWorksFlow() {
  const { lang } = useSettingsStore();

  const steps = [
    {
      num: '01',
      title: t('howStep1Title', lang),
      desc: t('howStep1Desc', lang),
      icon: <Type className="w-6 h-6 text-accent-gold" />,
      detail: t('howStep1Detail', lang)
    },
    {
      num: '02',
      title: t('howStep2Title', lang),
      desc: t('howStep2Desc', lang),
      icon: <Sliders className="w-6 h-6 text-accent-gold" />,
      detail: t('howStep2Detail', lang)
    },
    {
      num: '03',
      title: t('howStep3Title', lang),
      desc: t('howStep3Desc', lang),
      icon: <Zap className="w-6 h-6 text-accent-gold" />,
      detail: t('howStep3Detail', lang)
    }
  ];

  return (
    <section className="w-full max-w-[1280px] mx-auto px-6 py-20 relative z-10 border-t border-border-color/50">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border-color font-mono text-xs font-bold text-accent-gold uppercase tracking-widest mb-4">
          {t('howItWorksEyebrow', lang)}
        </div>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 tracking-tight">
          {t('howItWorksTitle1', lang)}
          <span className="text-accent-gold">{t('howItWorksTitle2', lang)}</span>
        </h2>
        <p className="text-base md:text-lg text-text-muted font-body">
          {t('howItWorksDesc', lang)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: idx * 0.12 }}
            className="group relative bg-[#16161A] border border-[#2A2A30] hover:border-accent-gold/50 rounded-2xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,179,1,0.08)] hover:-translate-y-1"
          >
            {/* Top Step Counter & Icon */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#1D1D22] border border-[#2A2A30] group-hover:border-accent-gold/40 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-md">
                  {step.icon}
                </div>
                <span className="font-mono text-3xl font-black text-white/20 group-hover:text-accent-gold/40 transition-colors">
                  {step.num}
                </span>
              </div>

              <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-accent-gold transition-colors">
                {step.title}
              </h3>
              <p className="text-sm text-text-muted font-body leading-relaxed mb-6">
                {step.desc}
              </p>
            </div>

            {/* Bottom Benefit Tag */}
            <div className="pt-4 border-t border-border-color/60 flex items-center gap-2 text-xs font-mono text-zinc-300">
              <CheckCircle2 size={14} className="text-accent-gold flex-shrink-0" />
              <span className="truncate">{step.detail}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
