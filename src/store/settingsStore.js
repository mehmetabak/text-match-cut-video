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
      highQuality: false, // Beta yüksek kalite ayarı
      cookieConsent: { analytics: true, essential: true, hasConsented: false },
      
      // Uygulama Durumu
      isGenerating: false,
      progress: 0,
      videoUrl: null,
      statusText: '', // Yeni durum metni

      // Fonksiyonlar
      setSetting: (key, value) => set({ [key]: value }),
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
