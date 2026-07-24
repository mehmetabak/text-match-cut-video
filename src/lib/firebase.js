import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Lütfen Firebase Console'dan aldığınız konfigürasyon bilgilerinizi buraya yapıştırın.
// Firebase'de "Authentication" bölümünden "Google" sağlayıcısını ve "Firestore Database"i aktifleştirmeyi unutmayın!
const firebaseConfig = {
  apiKey: "AIzaSyBl3XgIDNcEdMrpoUR8m32BGJcse2MP7pw",
  authDomain: "animation-maker-9e47a.firebaseapp.com",
  projectId: "animation-maker-9e47a",
  storageBucket: "animation-maker-9e47a.firebasestorage.app",
  messagingSenderId: "173113075897",
  appId: "1:173113075897:web:cf5aec0216490811359368",
  measurementId: "G-BG7GGP0EXZ"
};
const app = initializeApp(firebaseConfig);

// TODO: App Check (Güvenlik) için reCAPTCHA Site Key'inizi buraya girin
// Firebase Console > App Check sekmesinden kayıt yapıp Site Key almanız gerekir.
// Eğer henüz kurmadıysanız aşağıdaki satırları yoruma alabilirsiniz.
/*
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('BURAYA_RECAPTCHA_SITE_KEY_GELECEK'),
  isTokenAutoRefreshEnabled: true
});
*/

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
