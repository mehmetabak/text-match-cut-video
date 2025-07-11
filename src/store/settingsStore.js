// src/store/settingsStore.js
import { create } from 'zustand';

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
  lang: 'tr',
  
  // Uygulama Durumu
  isGenerating: false,
  progress: 0,
  videoUrl: null,
  statusText: '', // Yeni durum metni
  
  // Fonksiyonlar
  setSetting: (key, value) => set({ [key]: value }),
  setGenerationState: (state) => set(state),
}));