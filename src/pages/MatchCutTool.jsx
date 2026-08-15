import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { generateMatchCutData } from '../lib/textUtils';
import { VideoRenderer } from '../renderer/VideoRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Check } from 'lucide-react';
import SettingsPanel from '../components/SettingsPanel';
import Preview from '../components/Preview';
import AdPlaceholder from '../components/monetization/AdPlaceholder';
import { t } from '../lib/i18n';
import { Helmet } from 'react-helmet-async';

function MatchCutTool() {
  const setSetting = useSettingsStore(state => state.setSetting);
  const setGenerationState = useSettingsStore(state => state.setGenerationState);
  const lang = useSettingsStore(state => state.lang);
  const phrase = useSettingsStore(state => state.phrase);
  const fontFamily = useSettingsStore(state => state.fontFamily);
  const fontWeight = useSettingsStore(state => state.fontWeight);
  const textColor = useSettingsStore(state => state.textColor);
  const bgColor = useSettingsStore(state => state.bgColor);
  const bgType = useSettingsStore(state => state.bgType);
  const speed = useSettingsStore(state => state.speed);
  const resolution = useSettingsStore(state => state.resolution);
  const fps = useSettingsStore(state => state.fps);
  const format = useSettingsStore(state => state.format);
  const videoLength = useSettingsStore(state => state.videoLength);
  const textHighlight = useSettingsStore(state => state.textHighlight);
  const blurIntensity = useSettingsStore(state => state.blurIntensity);
  const darkTheme = useSettingsStore(state => state.darkTheme);
  const highQuality = useSettingsStore(state => state.highQuality);
  const renderMode = useSettingsStore(state => state.renderMode);
  const vignetteEffect = useSettingsStore(state => state.vignetteEffect);
  
  const user = useAuthStore(state => state.user);
  const saveProject = useAuthStore(state => state.saveProject);
  const projects = useAuthStore(state => state.projects);

  const canvasRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef(null);
  const hasInitialized = useRef(false);

  // 1. Taslak Projeyi Yükle veya Yeni Proje İçin Sıfırla
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const draftId = searchParams.get('draft');
    
    // Eğer linkte draft yoksa (Yeni Proje tıklanmışsa) ve bizde eski proje açık kalmışsa veya ilk kez açıyorsak, her şeyi sıfırla
    if (!draftId && (!hasInitialized.current || projectId)) {
      hasInitialized.current = true;
      setProjectId(null);
      setProjectName('');
      setSetting('phrase', 'match cut');
      setSetting('format', 'horizontal');
      setSetting('videoLength', 'Medium');
      setSetting('speed', 2.5);
      setSetting('darkTheme', true);
      setSetting('textHighlight', true);
      setSetting('blurIntensity', 'Medium');
      setSetting('fontFamily', "'Times New Roman', Times, serif");
      setSetting('highQuality', false);
      setSetting('renderMode', 'classic');
      setSetting('vignetteEffect', true);
      return;
    }

    // Eğer linkte draft varsa ve henüz bu projeyi yüklemediysek
    if (draftId && draftId !== projectId) {
      hasInitialized.current = true;
      // Önce localStorage'dan dene (Projects.jsx'ten geldiyse)
      const savedDraft = localStorage.getItem('draft_project');
      if (savedDraft) {
        try {
          const draftData = JSON.parse(savedDraft);
          if (draftData.id === draftId) {
            setProjectId(draftData.id);
            if (draftData.projectName) setProjectName(draftData.projectName);
            Object.keys(draftData).forEach(key => {
              if (key !== 'id') setSetting(key, draftData[key]);
            });
            localStorage.removeItem('draft_project');
            return;
          }
        } catch (e) {
          console.error("Draft error", e);
        }
      }

      // LocalStorage'da yoksa veya uyuşmuyorsa, Bulut projelerinden (projects) bul
      // Bu sayede linkle dışarıdan giren biri de projeyi açabilir
      if (projects && projects.length > 0) {
        const cloudDraft = projects.find(p => p.id === draftId);
        if (cloudDraft) {
          setProjectId(cloudDraft.id);
          if (cloudDraft.settings?.projectName) setProjectName(cloudDraft.settings.projectName);
          Object.keys(cloudDraft.settings || {}).forEach(key => {
            setSetting(key, cloudDraft.settings[key]);
          });
        }
      }
    }
  }, [location.search, setSetting, projects, projectId]);

  // 2. Auto-save (Debounced)
  useEffect(() => {
    if (!user) return; // Giriş yapmamışsa kaydetme

    const timeoutId = setTimeout(async () => {
      setSaveStatus('Saving...');
      const projectSettings = { 
        phrase, fontFamily, fontWeight, textColor, bgColor, bgType, speed, resolution, fps,
        format, videoLength, textHighlight, blurIntensity, darkTheme, highQuality,
        renderMode: renderMode || 'newspaper',
        vignetteEffect: vignetteEffect ?? true
      };
      
      // Varsayılan ayarlardan sapma olup olmadığını kontrol et
      const isDefault = 
        phrase === 'match cut' && 
        speed === 2.5 && 
        format === 'horizontal' && 
        videoLength === 'Medium' && 
        darkTheme === true && 
        textHighlight === true && 
        (renderMode === 'newspaper' || !renderMode) &&
        blurIntensity === 'Medium';

      // Boş proje kaydetmeyi engelle (İsim yok, proje ID yok ve her şey varsayılan)
      if (!projectName.trim() && !projectId && isDefault) {
        setSaveStatus('');
        return; 
      }

      // Firestore undefined değerleri kabul etmez, temizle
      Object.keys(projectSettings).forEach(key => {
        if (projectSettings[key] === undefined) {
          delete projectSettings[key];
        }
      });

      // İsmi de ayarlara ekle ki Firestore'a gitsin
      if (projectName.trim()) {
        projectSettings.projectName = projectName.trim();
      }

      // Aynı isimde bir proje varsa, yeni oluşturmak yerine onun ID'sini kullan (üzerine yaz)
      let targetProjectId = projectId;
      if (!targetProjectId && projectSettings.projectName) {
        const existingDuplicate = projects.find(p => p.settings?.projectName === projectSettings.projectName);
        if (existingDuplicate) {
          targetProjectId = existingDuplicate.id;
        }
      }

      const savedId = await saveProject('match-cut', projectSettings, targetProjectId);
      if (savedId && savedId !== projectId) {
        setProjectId(savedId);
        navigate(`?draft=${savedId}`, { replace: true });
      }
      setSaveStatus('Saved to Cloud');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1500); // 1.5 saniye bekle (Debounce)

    return () => clearTimeout(timeoutId);
  }, [phrase, fontFamily, fontWeight, textColor, bgColor, bgType, speed, resolution, fps, format, videoLength, textHighlight, blurIntensity, darkTheme, highQuality, renderMode, vignetteEffect, user, projectId, projectName, saveProject]);

  const handleGenerate = useCallback(async () => {
    if (!phrase.trim()) {
      alert(t('errorEmptyPhrase', lang));
      return;
    }

    setGenerationState({ isGenerating: true, videoUrl: null, progress: 0 });

    const currentSettings = useSettingsStore.getState();
    const mode = currentSettings.renderMode || 'newspaper';
    const textData = generateMatchCutData(phrase, mode);
    const renderer = new VideoRenderer(canvasRef.current, currentSettings, textData, (p) => setSetting('progress', p));
    
    try {
        const url = await renderer.generateVideo();
        setGenerationState({ isGenerating: false, videoUrl: url });
    } catch (error) {
        console.error("Video generation failed:", error);
        alert(t('errorGenerate', lang));
        setGenerationState({ isGenerating: false });
    }
  }, [phrase, lang, setSetting, setGenerationState]);

  return (
    <div className="w-full flex-grow flex flex-col h-full">
      <Helmet>
        <title>{lang === 'tr' ? 'Match Cut Video Oluşturucu — Çevrimiçi Tipografi Video Animasyonu | AnimationMaker' : 'Match Cut Video Maker — Online Typography Video Animation | AnimationMaker'}</title>
        <meta name="description" content={lang === 'tr' ? 'Kelimelerinizle mükemmel senkronize olan dinamik Match Cut tipografi animasyonları ve video kesitleri oluşturun.' : 'Create dynamic match cut kinetic typography video animations synchronized with your chosen keywords in seconds.'} />
        <meta name="keywords" content="match cut video maker, kinetic typography, sync text video generator, dynamic text video, online video editor, animationmaker" />
        <link rel="canonical" href="https://animationmaker.m0s.space/match-cut" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content="Match Cut Video Maker | AnimationMaker" />
        <meta property="og:description" content="Create dynamic match cut kinetic typography animations in seconds." />
        <meta property="og:url" content="https://animationmaker.m0s.space/match-cut" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Match Cut Video Maker | AnimationMaker" />
        <meta name="twitter:description" content="Create dynamic match cut typography video animations in seconds." />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/logo.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Match Cut Video Maker",
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "description": "Create dynamic match cut kinetic typography video animations synchronized with your chosen keywords.",
            "url": "https://animationmaker.m0s.space/match-cut",
            "publisher": {
              "@type": "Organization",
              "name": "AnimationMaker",
              "url": "https://animationmaker.m0s.space"
            }
          })}
        </script>
      </Helmet>
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10 h-full min-h-0"
      >
        <header className="mb-6 flex-shrink-0 flex justify-between items-start">
          <div>
            <AnimatePresence mode="wait">
              {isEditingName ? (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    placeholder="Proje İsmi..."
                    className="bg-zinc-900 border border-zinc-700 focus:border-accent-gold text-white text-xl sm:text-2xl font-bold px-3 py-1 rounded-lg outline-none w-full max-w-[300px]"
                    autoFocus
                  />
                  <button onClick={() => setIsEditingName(false)} className="p-2 bg-accent-gold text-black rounded-lg hover:bg-yellow-400">
                    <Check size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 mb-2 group cursor-pointer w-fit"
                  onClick={() => setIsEditingName(true)}
                >
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                    {projectName || (
                      <span>{t('matchCutToolTitle1', lang)} <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">{t('matchCutToolTitle2', lang)}</span></span>
                    )}
                  </h2>
                  {user && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                      <Edit2 size={16} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
              {t('matchCutToolDesc', lang)}
            </p>
          </div>
          {saveStatus && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 text-xs font-mono bg-zinc-900/90 px-3 py-1.5 rounded-full text-zinc-300 border border-zinc-700 shadow-lg absolute top-4 right-4 sm:relative sm:top-0 sm:right-0"
            >
              <span className={`w-2 h-2 rounded-full ${saveStatus === 'Saving...' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
              {saveStatus}
            </motion.div>
          )}
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

        </main>
      </motion.div>
    </div>
  );
}

export default MatchCutTool;
