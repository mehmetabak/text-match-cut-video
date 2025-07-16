import { create } from 'zustand';

function detectLanguage() {
  const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  return browserLang.startsWith('tr') ? 'tr' : 'en';
}

export const useSettingsStore = create((set) => ({
  // Ayarlar
  phrase: 'match cut',
  format: 'horizontal',
  videoLength: 'Medium', // Short (15), Medium (30), Long (50) cuts
  speed: 2.5,
  darkTheme: true,
  textHighlight: true,
  blurIntensity: 'Medium',
  fontFamily: "'Times New Roman', Times, serif",
  lang: detectLanguage(),  // Otomatik dil tespiti
  
  // Uygulama Durumu
  isGenerating: false,
  progress: 0,
  videoUrl: null,
  statusText: '', // Yeni durum metni

  // Fonksiyonlar
  setSetting: (key, value) => set({ [key]: value }),
  setGenerationState: (state) => set(state),
}));
