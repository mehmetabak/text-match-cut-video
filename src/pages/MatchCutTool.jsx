import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { generateMatchCutData } from '../lib/textUtils';
import { VideoRenderer } from '../renderer/VideoRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Check, Plus } from 'lucide-react';
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
  const renderResolution = useSettingsStore(state => state.renderResolution);
  const renderSpeed = useSettingsStore(state => state.renderSpeed);
  const highQuality = useSettingsStore(state => state.highQuality);
  const fastRender = useSettingsStore(state => state.fastRender);
  const experimentalRender = useSettingsStore(state => state.experimentalRender);
  const renderMode = useSettingsStore(state => state.renderMode);
  const vignetteEffect = useSettingsStore(state => state.vignetteEffect);
  const user = useAuthStore(state => state.user);
  const authLoading = useAuthStore(state => state.loading);
  const saveProject = useAuthStore(state => state.saveProject);
  const projects = useAuthStore(state => state.projects);

  useEffect(() => {
    if (!authLoading && !user && typeof window !== 'undefined') {
      if (!sessionStorage.getItem('guest_mode_enabled')) {
        useAuthStore.getState().openAuthModal();
      }
    }
  }, [authLoading, user]);

  const canvasRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectId, setProjectId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef(null);
  const hasInitialized = useRef(false);
  const loadedDraftIdRef = useRef(null);
  const isAutoSavingRef = useRef(false);

  const lastSavedSnapshotRef = useRef(null);

  const handleNewProject = () => {
    loadedDraftIdRef.current = null;
    lastSavedSnapshotRef.current = null;
    setSearchParams({}, { replace: true });
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
    setSetting('renderResolution', 'hd');
    setSetting('renderSpeed', 'standard');
    setSetting('highQuality', false);
    setSetting('fastRender', false);
    setSetting('experimentalRender', false);
    setSetting('renderMode', 'classic');
    setSetting('vignetteEffect', true);
  };

  const applyDraftSettings = useCallback((s, draftId) => {
    if (!s) return;
    setProjectId(draftId);
    loadedDraftIdRef.current = draftId;
    lastSavedSnapshotRef.current = JSON.stringify(s);
    if (s.projectName) setProjectName(s.projectName);
    Object.keys(s).forEach(key => {
      if (key !== 'id' && key !== 'projectName') {
        setSetting(key, s[key]);
      }
    });
  }, [setSetting]);

  // 1. Taslak Projeyi Yükle veya Yeni Proje İçin Sıfırla
  useEffect(() => {
    const draftId = searchParams.get('draft');
    
    // Eğer linkte draft yoksa (Yeni Proje tıklanmışsa veya temiz açılmışsa)
    if (!draftId) {
      if (loadedDraftIdRef.current !== null || !hasInitialized.current) {
        hasInitialized.current = true;
        loadedDraftIdRef.current = null;
        setProjectId(null);
        setProjectName('');
        if (!projectId) {
          handleNewProject();
        }
      }
      return;
    }

    // Eğer bu taslak zaten belleğe yüklenmiş ve aktif düzenleniyorsa tekrar üzerine yazma!
    if (draftId === loadedDraftIdRef.current) {
      return;
    }

    hasInitialized.current = true;

    // 1. Önce localStorage'dan dene (Projects.jsx'ten geldiyse)
    const savedDraft = localStorage.getItem('draft_project');
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        if (draftData.id === draftId) {
          applyDraftSettings(draftData, draftId);
          localStorage.removeItem('draft_project');
          return;
        }
      } catch (e) {
        console.warn("Draft error", e);
      }
    }

    // 2. Araç özelindeki yerel taslaktan dene
    const toolDraft = localStorage.getItem('draft_project_match-cut');
    if (toolDraft) {
      try {
        const draftData = JSON.parse(toolDraft);
        if (draftData.id === draftId) {
          applyDraftSettings(draftData.settings || draftData, draftId);
          return;
        }
      } catch (e) {
        console.warn("Tool draft error", e);
      }
    }

    // 3. Bulut projelerinden (projects) bul
    if (projects && projects.length > 0) {
      const cloudDraft = projects.find(p => p.id === draftId);
      if (cloudDraft && cloudDraft.settings) {
        applyDraftSettings(cloudDraft.settings, draftId);
        return;
      }
    }

    // 4. Doğrudan Firestore'dan çekmeyi dene
    const fetchAuthStoreProject = useAuthStore.getState().fetchProjectDoc;
    if (fetchAuthStoreProject) {
      fetchAuthStoreProject(draftId).then((docData) => {
        if (docData && docData.settings && loadedDraftIdRef.current !== draftId) {
          applyDraftSettings(docData.settings, draftId);
        }
      }).catch(err => {
        console.warn("MatchCut draft fetch error:", err);
      });
    }
  }, [searchParams, projects, applyDraftSettings]);

  // 2. Auto-save (Debounced)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const projectSettings = { 
        phrase, fontFamily, fontWeight, textColor, bgColor, bgType, speed, resolution, fps,
        format, videoLength, textHighlight, blurIntensity, darkTheme,
        renderResolution: renderResolution || 'hd',
        renderSpeed: renderSpeed || 'standard',
        highQuality, fastRender, experimentalRender,
        renderMode: renderMode || 'newspaper',
        vignetteEffect: vignetteEffect ?? true
      };

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

      const currentSnapshot = JSON.stringify(projectSettings);

      // Değişiklik yoksa kaydetme! (Sürekli kaydetme döngüsünü engeller)
      if (currentSnapshot === lastSavedSnapshotRef.current) {
        return;
      }
      
      // Varsayılan ayarlardan sapma olup olmadığını kontrol et
      const isDefault = 
        phrase === 'match cut' && 
        speed === 2.5 && 
        format === 'horizontal' && 
        videoLength === 'Medium' && 
        darkTheme === true && 
        textHighlight === true && 
        (renderMode === 'newspaper' || !renderMode) &&
        blurIntensity === 'Medium' &&
        renderResolution === 'hd' &&
        renderSpeed === 'standard' &&
        !highQuality &&
        !fastRender &&
        !experimentalRender &&
        !projectName.trim();

      // Boş ve değiştirilmemiş varsayılan projeyi kaydetmeyi engelle
      if (!projectId && isDefault) {
        return; 
      }

      setSaveStatus(t('saving', lang));

      // Aynı isimde bir proje varsa, yeni oluşturmak yerine onun ID'sini kullan (üzerine yaz)
      let targetProjectId = projectId;
      if (!targetProjectId && projectSettings.projectName) {
        const existingDuplicate = projects.find(p => p.settings?.projectName === projectSettings.projectName);
        if (existingDuplicate) {
          targetProjectId = existingDuplicate.id;
        }
      }

      try {
        isAutoSavingRef.current = true;
        const savedId = await saveProject('match-cut', projectSettings, targetProjectId);
        if (savedId) {
          setProjectId(savedId);
          loadedDraftIdRef.current = savedId;
          lastSavedSnapshotRef.current = currentSnapshot;
          const currentParam = searchParams.get('draft');
          if (currentParam !== savedId) {
            setSearchParams({ draft: savedId }, { replace: true });
          }
        }
        setSaveStatus(user ? t('savedToCloud', lang) : t('draftSaved', lang));
        setTimeout(() => setSaveStatus(''), 2500);
      } catch (err) {
        console.error("MatchCut auto-save error:", err);
        setSaveStatus('');
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 1500); // 1.5 saniye bekle (Debounce)

    return () => clearTimeout(timeoutId);
  }, [
    phrase, fontFamily, fontWeight, textColor, bgColor, bgType, speed, resolution, fps,
    format, videoLength, textHighlight, blurIntensity, darkTheme, renderResolution, renderSpeed,
    highQuality, fastRender, experimentalRender, renderMode, vignetteEffect, projectName, user
  ]);

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
        
        {/* Multilingual Hreflang Tags */}
        <link rel="alternate" hrefLang="x-default" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="en" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="tr" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="de" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="fr" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="es" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="zh" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="ar" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="ko" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="ja" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="id" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="th" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="hi" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="ru" href="https://animationmaker.m0s.space/match-cut" />
        <link rel="alternate" hrefLang="pt" href="https://animationmaker.m0s.space/match-cut" />

        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content="Match Cut Video Maker | AnimationMaker" />
        <meta property="og:description" content="Create dynamic match cut kinetic typography animations in seconds." />
        <meta property="og:url" content="https://animationmaker.m0s.space/match-cut" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Match Cut Video Maker | AnimationMaker" />
        <meta name="twitter:description" content="Create dynamic match cut typography video animations in seconds." />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Match Cut Video Maker",
              "applicationCategory": "MultimediaApplication",
              "operatingSystem": "Web, Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "description": "Create dynamic match cut typography video animations directly in your browser with zero server uploads.",
              "url": "https://animationmaker.m0s.space/match-cut",
              "publisher": {
                "@type": "Organization",
                "name": "AnimationMaker",
                "url": "https://animationmaker.m0s.space"
              }
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://animationmaker.m0s.space"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Tools",
                  "item": "https://animationmaker.m0s.space/tools"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Text Match Cut",
                  "item": "https://animationmaker.m0s.space/match-cut"
                }
              ]
            }
          ])}
        </script>
      </Helmet>
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10 h-full min-h-0"
      >
        <header className="mb-4 sm:mb-6 flex-shrink-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 pr-28 sm:pr-0">
          <div className="min-w-0 flex-1">
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
                    placeholder={t('projectNamePlaceholder', lang)}
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
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1 sm:mt-0">
            {user && (
              <button
                onClick={handleNewProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700/80 shadow-md transition-all active:scale-95"
                title={t('freshProjectTitle', lang)}
              >
                <Plus size={14} className="text-[#F5B301]" />
                <span>{t('newProject', lang)}</span>
              </button>
            )}
            {saveStatus && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 text-xs font-mono bg-zinc-900/90 px-3 py-1.5 rounded-full text-zinc-300 border border-zinc-700 shadow-lg"
              >
                <span className={`w-2 h-2 rounded-full ${saveStatus === 'Saving...' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                {saveStatus}
              </motion.div>
            )}
          </div>
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
