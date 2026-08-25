import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function detectLanguage() {
  const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  const supported = ['en', 'tr', 'de', 'fr', 'es', 'zh', 'ar', 'ko', 'ja', 'id', 'th', 'hi', 'ru', 'pt'];
  return supported.includes(langCode) ? langCode : 'en';
}

export const useSettingsStore = create(
  persist(
    (set) => ({
      // Ayarlar
      isHeaderCollapsed: false,
      phrase: 'match cut',
      format: 'horizontal',
      videoLength: 'Medium', // Short (15), Medium (30), Long (50) cuts
      speed: 2.5,
      darkTheme: true,
      textHighlight: true,
      blurIntensity: 'Medium',
      fontFamily: "'Times New Roman', Times, serif",
      lang: detectLanguage(),  // Otomatik dil tespiti
      renderResolution: 'hd', // 'hd' (720p) | 'full_hd' (1080p)
      renderSpeed: 'standard', // 'standard' (slow/master) | 'fast' (turbo)
      highQuality: false, // Beta yüksek kalite ayarı (Full HD + Standard)
      fastRender: false, // Hızlı render (Turbo) modu (HD + Fast)
      experimentalRender: false, // Deneysel Hızlı 1080p (Full HD + Fast)
      renderMode: 'classic', // Varsayılan: 'classic' (Klasik), Seçenek: 'newspaper' (Gazete / Yeni Mod)
      vignetteEffect: true, // Sinematik kenar karartma
      cookieConsent: { analytics: true, essential: true, hasConsented: false },
      
      // Uygulama Durumu
      isGenerating: false,
      progress: 0,
      videoUrl: null,
      statusText: '', // Yeni durum metni

      // Fonksiyonlar
      setSetting: (key, value) => set((state) => {
        let next = { ...state, [key]: value };

        if (key === 'renderResolution' || key === 'renderSpeed') {
          const res = key === 'renderResolution' ? value : (state.renderResolution || 'hd');
          const speed = key === 'renderSpeed' ? value : (state.renderSpeed || 'standard');
          
          if (res === 'full_hd' && speed === 'fast') {
            next.experimentalRender = true;
            next.highQuality = false;
            next.fastRender = false;
          } else if (res === 'full_hd' && speed === 'standard') {
            next.highQuality = true;
            next.experimentalRender = false;
            next.fastRender = false;
          } else if (res === 'hd' && speed === 'fast') {
            next.fastRender = true;
            next.highQuality = false;
            next.experimentalRender = false;
          } else {
            // hd + standard
            next.fastRender = false;
            next.highQuality = false;
            next.experimentalRender = false;
          }
        } else if (key === 'experimentalRender' && value) {
          next.renderResolution = 'full_hd';
          next.renderSpeed = 'fast';
          next.highQuality = false;
          next.fastRender = false;
        } else if (key === 'highQuality' && value) {
          next.renderResolution = 'full_hd';
          next.renderSpeed = 'standard';
          next.fastRender = false;
          next.experimentalRender = false;
        } else if (key === 'fastRender' && value) {
          next.renderResolution = 'hd';
          next.renderSpeed = 'fast';
          next.highQuality = false;
          next.experimentalRender = false;
        }

        return next;
      }),
      setGenerationState: (state) => set(state),
    }),
    {
      name: 'settings-storage', // name of the item in the storage (must be unique)
      partialize: (state) => {
        const { isGenerating, progress, videoUrl, statusText, ...rest } = state;
        return rest;
      },
    }
  )
);
