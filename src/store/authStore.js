import { create } from 'zustand';
import { 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  projects: [],
  projectsLoading: false,

  // Global Auth Modal State
  authModalOpen: false,
  pendingAction: null,
  projectsUnsubscribe: null,
  
  openAuthModal: (action) => set({ authModalOpen: true, pendingAction: action }),
  closeAuthModal: () => set({ authModalOpen: false, pendingAction: null }),

  // Kullanıcı giriş yaptığında profil bilgisini Firestore'dan çeker/oluşturur
  initUser: async (authUser) => {
    if (!authUser) {
      set({ user: null, loading: false, projects: [] });
      return;
    }

    try {
      const userRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userRef);

      let userData = {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        subscriptionPlan: 'free',
        adRewardPoints: 0,
        adRewardsToday: 0,
        lastAdRewardDate: '',
        lastLoginAt: serverTimestamp(),
      };

      if (!userSnap.exists()) {
        // İlk giriş, yeni profil oluştur
        userData.createdAt = serverTimestamp();
        await setDoc(userRef, userData);
      } else {
        // Mevcut kullanıcı, login timestamp'i ve profil fotoğrafını/ismini güncelle
        const updates = { 
          lastLoginAt: serverTimestamp(),
          displayName: authUser.displayName || null,
          photoURL: authUser.photoURL || null
        };
        await setDoc(userRef, updates, { merge: true });
        // Veritabanındaki eski veriyi, güncel Google verisiyle birleştir
        userData = { ...userData, ...userSnap.data(), ...updates };
      }

      set({ user: userData, loading: false });
      get().subscribeToProjects(authUser.uid);
      
      // JIT Subscription Sync (İlk açılışta kontrol)
      get().syncSubscriptionJIT();

      // Arka planda her 5 dakikada bir aboneliği kontrol et (Interval)
      if (get().subscriptionInterval) clearInterval(get().subscriptionInterval);
      const interval = setInterval(() => {
        if (get().user) {
          get().syncSubscriptionJIT();
        }
      }, 5 * 60 * 1000); // 5 dakika
      set({ subscriptionInterval: interval });

    } catch (error) {
      console.warn("Kullanıcı verisi alınırken/yazılırken hata (offline fallback):", error);
      set({ 
        user: {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          subscriptionPlan: 'free',
          adRewardPoints: 0,
        }, 
        loading: false 
      });
    }
  },

  loginWithGoogle: async () => {
    try {
      console.log("Google ile giriş başlatılıyor (Redirect)...");
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Google Giriş Yönlendirme Hatası:", error);
      throw error; 
    }
  },

  logout: async () => {
    try {
      const { projectsUnsubscribe, subscriptionInterval } = get();
      if (projectsUnsubscribe) {
        projectsUnsubscribe();
      }
      if (subscriptionInterval) {
        clearInterval(subscriptionInterval);
      }
      await signOut(auth);
      set({ user: null, projects: [], projectsUnsubscribe: null, subscriptionInterval: null });
    } catch (error) {
      console.error("Çıkış Hatası:", error);
    }
  },

  // Projeleri canlı olarak dinleme (Gerçek zamanlı)
  subscribeToProjects: (uid) => {
    set({ projectsLoading: true });
    const q = query(collection(db, 'users', uid, 'projects'), orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList = [];
      snapshot.forEach((docSnap) => {
        projectsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      set({ projects: projectsList, projectsLoading: false });
    }, (error) => {
      console.warn("Projeler dinlenirken uyarı:", error);
      set({ projectsLoading: false });
    });

    set({ projectsUnsubscribe: unsubscribe });
  },

  fetchProjectDoc: async (projectId) => {
    if (!projectId) return null;
    const { projects, user } = get();
    // 1. Önce bellekteki projelerden ara
    const inMem = projects.find(p => p.id === projectId);
    if (inMem) return inMem;

    // 2. Giriş yapmışsa doğrudan Firestore'dan çek
    if (user && user.uid && !projectId.startsWith('local_')) {
      try {
        const docRef = doc(db, 'users', user.uid, 'projects', projectId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("Direct project fetch warning:", err);
      }
    }
    return null;
  },

  // Polar'dan canlı abonelik kontrolü yapan JIT (Just-In-Time) Sync
  syncSubscriptionJIT: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/sync-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.isPro !== undefined && data.isPro !== user.isPro) {
          set({ user: { ...user, isPro: data.isPro } });
          console.log("[JIT Sync] Subscription status updated to:", data.isPro);
        }
      }
    } catch (error) {
      console.warn("JIT subscription sync warning:", error);
    }
  },

  // Araç içinden Auto-save veya manuel kaydetme için kullanılacak
  saveProject: async (toolId, settings, existingProjectId = null) => {
    const { user } = get();
    const localKey = 'draft_project_' + toolId;
    
    // Misafir kullanıcı için yerel taslak oluştur
    if (!user) {
      const guestId = existingProjectId || ('local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
      try {
        localStorage.setItem(localKey, JSON.stringify({ id: guestId, toolId, settings }));
      } catch (e) {
        console.warn("Local storage write error:", e);
      }
      return guestId;
    }

    try {
      const projectsRef = collection(db, 'users', user.uid, 'projects');
      const projectData = {
        toolId,
        settings,
        updatedAt: serverTimestamp(),
      };

      let finalId = existingProjectId;
      if (existingProjectId && !existingProjectId.startsWith('local_')) {
        const docRef = doc(db, 'users', user.uid, 'projects', existingProjectId);
        await setDoc(docRef, projectData, { merge: true });
      } else {
        projectData.createdAt = serverTimestamp();
        const newDoc = await addDoc(projectsRef, projectData);
        finalId = newDoc.id;
      }

      try {
        localStorage.setItem(localKey, JSON.stringify({ id: finalId, toolId, settings }));
      } catch (e) {
        console.warn("Local storage write error:", e);
      }
      return finalId;
    } catch (error) {
      console.warn("Proje kaydedilirken hata (local fallback):", error);
      const fallbackId = existingProjectId || ('local_' + Date.now().toString(36));
      try {
        localStorage.setItem(localKey, JSON.stringify({ id: fallbackId, toolId, settings }));
      } catch (e) {
        console.warn("Local storage write error:", e);
      }
      return fallbackId;
    }
  },

  isRewardModalOpen: false,
  setRewardModalOpen: (isOpen) => set({ isRewardModalOpen: isOpen }),

  earnRewardPoints: async (pointsToAdd) => {
    const { user } = get();
    if (!user) return { success: false, message: "Giriş yapmanız gerekiyor." };
    
    try {
      const token = await auth.currentUser.getIdToken(true);
      
      const response = await fetch('/api/earn-reward', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points: pointsToAdd })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { success: false, message: data.message || "Günlük limitinize ulaştınız veya bir hata oluştu." };
      }
      
      set({ 
        user: { 
          ...user, 
          adRewardPoints: data.data.adRewardPoints, 
          adRewardsToday: data.data.adRewardsToday, 
          lastAdRewardDate: data.data.lastAdRewardDate 
        } 
      });
      return { success: true };
    } catch (error) {
      console.error("Ödül puanı eklenirken hata:", error);
      return { success: false, message: "Bir hata oluştu. Lütfen tekrar deneyin." };
    }
  },

  deleteProject: async (projectId) => {
    const { user } = get();
    if (!user || !projectId) return false;

    try {
      const docRef = doc(db, 'users', user.uid, 'projects', projectId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Proje silinirken hata:", error);
      return false;
    }
  }
}));

onAuthStateChanged(auth, (user) => {
  useAuthStore.getState().initUser(user);
});

// Redirect sonrası oluşan hataları (örneğin kullanıcı iptali veya 3. parti çerez bloklanması) yakala
getRedirectResult(auth).catch((error) => {
  console.error("Yönlendirme (Redirect) sonrası giriş hatası:", error);
});
