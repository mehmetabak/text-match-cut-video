import React, { useRef, useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { generateRandomText } from '../lib/textUtils';
import { VideoRenderer } from '../renderer/VideoRenderer';
import { motion } from 'framer-motion';
import SettingsPanel from '../components/SettingsPanel';
import Preview from '../components/Preview';
import AdPlaceholder from '../components/monetization/AdPlaceholder';
import { t } from '../lib/i18n';

function MatchCutTool() {
  const settings = useSettingsStore();
  const { setSetting, setGenerationState, lang, phrase } = settings;
  const canvasRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    if (!phrase.trim()) {
      alert(t('errorEmptyPhrase', lang));
      return;
    }

    setGenerationState({ isGenerating: true, videoUrl: null, progress: 0 });

    const textData = generateRandomText(phrase);
    const renderer = new VideoRenderer(canvasRef.current, settings, textData, (p) => setSetting('progress', p));
    
    try {
        const url = await renderer.generateVideo();
        setGenerationState({ isGenerating: false, videoUrl: url });
    } catch (error) {
        console.error("Video generation failed:", error);
        alert(t('errorGenerate', lang));
        setGenerationState({ isGenerating: false });
    }
  }, [settings, phrase, lang, setSetting, setGenerationState]);

  return (
    <div className="w-full flex-grow flex flex-col h-full">
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10 h-full min-h-0"
      >
        <header className="mb-6 flex-shrink-0">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
            {t('matchCutToolTitle1', lang)} <span className="text-yellow-400">{t('matchCutToolTitle2', lang)}</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
            {t('matchCutToolDesc', lang)}
          </p>
        </header>

        <main className="flex flex-col lg:flex-row gap-6 lg:gap-6 flex-1 min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          {/* Settings Column */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col h-auto lg:h-full lg:overflow-hidden gap-4">
            <div className="flex-1 lg:overflow-y-auto lg:pr-2 lg:custom-scrollbar">
              <SettingsPanel onGenerate={handleGenerate} />
            </div>
          </div>
          
          {/* Video Preview Column */}
          <div className="flex-1 flex flex-col h-auto lg:h-full min-h-[400px] lg:min-h-0">
             <Preview />
          </div>

          {/* AdMob Banner Column */}
          <div className="w-full lg:w-[160px] flex-shrink-0 flex flex-col items-center lg:items-end justify-center mt-2 lg:mt-0 lg:h-full min-h-0 pt-4 lg:pt-0">
            {/* Mobile: Smart Banner (~320x100). Desktop: 160x600 Vertical */}
            <div className="w-full lg:w-[160px] h-[100px] lg:h-[600px] lg:max-h-full">
              <AdPlaceholder className="w-full h-full rounded-xl lg:rounded-2xl" />
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  );
}

export default MatchCutTool;
