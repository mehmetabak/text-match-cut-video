import { create } from 'zustand';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  getRedirectResult
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
        // Mevcut kullanıcı, login timestamp'i güncelle
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
        userData = { ...userData, ...userSnap.data() };
      }

      set({ user: userData, loading: false });
      get().subscribeToProjects(authUser.uid);
      
      // JIT Subscription Sync (Arka planda sessizce Polar'ı kontrol et)
      get().syncSubscriptionJIT();
    } catch (error) {
      console.error("Kullanıcı verisi alınırken/yazılırken hata (Büyük ihtimalle Firestore kurulu değil veya Kuralları kapalı):", error);
      alert("Giriş başarılı oldu ancak veritabanına ulaşılamadı. Lütfen Firebase Console'dan 'Firestore Database' oluşturduğunuzdan ve Kurallar (Rules) kısmından okuma/yazma izni verdiğinizden emin olun.\n\nHata Detayı: " + error.message);
      set({ user: null, loading: false });
    }
  },

  loginWithGoogle: async () => {
    try {
      // COOP/CSP uyumluluğu ve popup engelleyicileri aşmak için Redirect kullanıyoruz
      const { signInWithRedirect } = await import('firebase/auth');
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Google Giriş Hatası:", error);
      throw error; 
    }
  },

  logout: async () => {
    try {
      const { projectsUnsubscribe } = get();
      if (projectsUnsubscribe) {
        projectsUnsubscribe();
      }
      await signOut(auth);
      set({ user: null, projects: [], projectsUnsubscribe: null });
    } catch (error) {
      console.error("Çıkış Hatası:", error);
    }
  },

  // Projeleri canlı olarak dinleme (Gerçek zamanlı)
  subscribeToProjects: (uid) => {
    set({ projectsLoading: true });
    const q = query(collection(db, 'users', uid, 'projects'), orderBy('updatedAt', 'desc'));
    
    // Unsubscribe fonksiyonunu döndürelim, isterseniz cleanup için tutabilirsiniz
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList = [];
      snapshot.forEach((docSnap) => {
        projectsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      set({ projects: projectsList, projectsLoading: false });
    }, (error) => {
      console.error("Projeler dinlenirken hata:", error);
      set({ projectsLoading: false });
    });

    set({ projectsUnsubscribe: unsubscribe });
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
        // Sadece durum değişmişse yerel durumu güncelle (Firestore zaten backend'de güncellenir)
        if (data.isPro !== undefined && data.isPro !== user.isPro) {
          set({ user: { ...user, isPro: data.isPro } });
          console.log("[JIT Sync] Subscription status updated to:", data.isPro);
        }
      }
    } catch (error) {
      console.error("JIT subscription sync failed:", error);
    }
  },

  // Araç içinden Auto-save veya manuel kaydetme için kullanılacak
  saveProject: async (toolId, settings, existingProjectId = null) => {
    const { user } = get();
    if (!user) return null; // Giriş yapmamışsa kaydetme

    try {
      const projectsRef = collection(db, 'users', user.uid, 'projects');
      const projectData = {
        toolId,
        settings,
        updatedAt: serverTimestamp(),
      };

      if (existingProjectId) {
        // Mevcut projeyi güncelle
        const docRef = doc(db, 'users', user.uid, 'projects', existingProjectId);
        await setDoc(docRef, projectData, { merge: true });
        return existingProjectId;
      } else {
        // Yeni proje oluştur
        projectData.createdAt = serverTimestamp();
        const newDoc = await addDoc(projectsRef, projectData);
        return newDoc.id;
      }
    } catch (error) {
      console.error("Proje kaydedilirken hata:", error);
      return null;
    }
  },

  isRewardModalOpen: false,
  setRewardModalOpen: (isOpen) => set({ isRewardModalOpen: isOpen }),

  earnRewardPoints: async (pointsToAdd) => {
    const { user } = get();
    if (!user) return { success: false, message: "Giriş yapmanız gerekiyor." };
    
    try {
      // 1. Get Firebase Auth Token securely
      const token = await auth.currentUser.getIdToken(true);
      
      // 2. Call our secure backend to handle the reward logic
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
      
      // 3. Update local state immediately with verified backend data
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

// Uygulama başlarken auth state'i dinle
getRedirectResult(auth)
  .then((result) => {
    if (result?.user) {
      console.log("Redirect login successful");
    }
  })
  .catch((error) => {
    console.error("Redirect login error:", error);
  });

onAuthStateChanged(auth, (user) => {
  useAuthStore.getState().initUser(user);
});
