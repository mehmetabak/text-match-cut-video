import { create } from 'zustand';
import { 
  signInWithPopup, 
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
    } catch (error) {
      console.error("Kullanıcı verisi alınırken/yazılırken hata (Büyük ihtimalle Firestore kurulu değil veya Kuralları kapalı):", error);
      alert("Giriş başarılı oldu ancak veritabanına ulaşılamadı. Lütfen Firebase Console'dan 'Firestore Database' oluşturduğunuzdan ve Kurallar (Rules) kısmından okuma/yazma izni verdiğinizden emin olun.\n\nHata Detayı: " + error.message);
      set({ user: null, loading: false });
    }
  },

  loginWithGoogle: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
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
      const userRef = doc(db, 'users', user.uid);
      const today = new Date().toISOString().split('T')[0];
      
      let adsToday = user.adRewardsToday || 0;
      let lastDate = user.lastAdRewardDate || '';
      
      if (lastDate !== today) {
        adsToday = 0;
        lastDate = today;
      }
      
      if (adsToday >= 5) {
        return { success: false, message: "Günlük reklam izleme limitine (5) ulaştınız. Yarın tekrar deneyin!" };
      }
      
      const newPoints = (user.adRewardPoints || 0) + pointsToAdd;
      adsToday += 1;
      
      await setDoc(userRef, { 
        adRewardPoints: newPoints,
        adRewardsToday: adsToday,
        lastAdRewardDate: lastDate
      }, { merge: true });
      
      // Update local state immediately
      set({ user: { ...user, adRewardPoints: newPoints, adRewardsToday: adsToday, lastAdRewardDate: lastDate } });
      return { success: true };
    } catch (error) {
      console.error("Ödül puanı eklenirken hata:", error);
      return { success: false, message: "Bir hata oluştu." };
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
onAuthStateChanged(auth, (user) => {
  useAuthStore.getState().initUser(user);
});
