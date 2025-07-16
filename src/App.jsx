// src/App.jsx
import React, { useRef, useCallback } from 'react';
import { useSettingsStore } from './store/settingsStore';
import { generateRandomText } from './lib/textUtils';
import { VideoRenderer } from './renderer/VideoRenderer';
import SettingsPanel from './components/SettingsPanel';
import Preview from './components/Preview';
import { t } from './lib/i18n';
import { Github } from 'lucide-react';

function App() {
  const settings = useSettingsStore();
  const { setSetting, setGenerationState, lang, phrase } = settings;
  const canvasRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    if (!phrase.trim()) {
      alert(lang === 'tr' ? 'Lütfen bir kelime grubu girin.' : 'Please enter a phrase.');
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
        alert(lang === 'tr' ? 'Video oluşturulurken bir hata oluştu.' : 'An error occurred during video generation.');
        setGenerationState({ isGenerating: false });
    }
  }, [settings, phrase, lang, setSetting, setGenerationState]);

  return (
    <div className="min-h-screen w-full bg-zinc-900 text-white font-sans bg-cover bg-center" style={{backgroundImage: 'url(/paper-texture.jpg)'}}>
      {/* Gizli canvas, render işlemleri için burada durur */}
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      <div className="min-h-screen w-full bg-black/60 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-col h-screen p-4 sm:p-6">
          <header className="mb-4 flex-shrink-0 flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {t('mainTitle', lang)}<span className="text-yellow-400">{t('mainTitleAccent', lang)}</span>
              </h1>
              <p className="text-gray-300 text-sm md:text-base">{t('subTitle', lang)}</p>
            </div>
            <div className="flex items-center space-x-3">
              <a href="https://github.com/mehmetabak/text-match-cut-video" title="GitHub" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors"><Github size={24} /></a>
              <div className="flex items-center space-x-1 bg-black/20 border border-gray-600 rounded-md p-1">
                <button onClick={() => setSetting('lang', 'tr')} className={`px-2 py-0.5 text-sm rounded transition-colors ${lang === 'tr' ? 'bg-yellow-500 text-black font-bold' : 'hover:bg-zinc-700'}`}>TR</button>
                <button onClick={() => setSetting('lang', 'en')} className={`px-2 py-0.5 text-sm rounded transition-colors ${lang === 'en' ? 'bg-yellow-500 text-black font-bold' : 'hover:bg-zinc-700'}`}>EN</button>
              </div>
            </div>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-grow min-h-0">
            <div className="lg:col-span-1 xl:col-span-1 lg:min-h-0">
              <SettingsPanel onGenerate={handleGenerate} />
            </div>
            <div className="lg:col-span-2 xl:col-span-3 flex items-center justify-center lg:min-h-0">
               <Preview />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;