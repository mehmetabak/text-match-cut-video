// src/store/toastStore.js
import { create } from 'zustand';

export const useToastStore = create((set, get) => {
  let timeoutId = null;

  return {
    toast: null,
    showToast: (message, type = 'info', duration = 3000) => {
      if (timeoutId) clearTimeout(timeoutId);
      set({ toast: { message, type, id: Date.now() } });
      timeoutId = setTimeout(() => {
        set({ toast: null });
        timeoutId = null;
      }, duration);
    },
    hideToast: () => {
      if (timeoutId) clearTimeout(timeoutId);
      set({ toast: null });
      timeoutId = null;
    }
  };
});
