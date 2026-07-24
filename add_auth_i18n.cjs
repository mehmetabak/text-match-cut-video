const fs = require('fs');
const content = fs.readFileSync('src/lib/i18n.js', 'utf8');

const translations = {
  en: {
    loginGoogle: "Login with Google",
    continueAsGuest: "Continue as Guest",
    saveProgressTitle: "Don't lose your work!",
    saveProgressDesc: "Login with Google in seconds to save your progress, settings, and earn reward points.",
    myProjects: "My Projects",
    projectsDesc: "All your past video drafts are safely stored here.",
    rewardPoints: "Points",
    logout: "Log out",
    noProjectsTitle: "No projects yet",
    noProjectsDesc: "Create a new video to get started.",
    goToTools: "Go to Tools"
  },
  tr: {
    loginGoogle: "Google ile Giriş Yap",
    continueAsGuest: "Giriş Yapmadan Devam Et",
    saveProgressTitle: "Çalışmalarınızı kaybetmeyin!",
    saveProgressDesc: "Google ile saniyeler içinde giriş yaparak ilerlemenizi, ürettiğiniz videoların ayarlarını kaydedin ve reklam ödülleri kazanın.",
    myProjects: "Projelerim",
    projectsDesc: "Geçmişte ürettiğiniz tüm videoların taslakları burada güvenle saklanır.",
    rewardPoints: "Puan",
    logout: "Çıkış Yap",
    noProjectsTitle: "Henüz projeniz yok",
    noProjectsDesc: "Yeni bir video oluşturarak hemen başlayın.",
    goToTools: "Araçlara Git"
  },
  de: {
    loginGoogle: "Mit Google anmelden",
    continueAsGuest: "Als Gast fortfahren",
    saveProgressTitle: "Verliere nicht deine Arbeit!",
    saveProgressDesc: "Melde dich in Sekundenschnelle mit Google an, um deinen Fortschritt und deine Einstellungen zu speichern und Belohnungspunkte zu sammeln.",
    myProjects: "Meine Projekte",
    projectsDesc: "Alle deine vergangenen Videoentwürfe werden hier sicher aufbewahrt.",
    rewardPoints: "Punkte",
    logout: "Abmelden",
    noProjectsTitle: "Noch keine Projekte",
    noProjectsDesc: "Erstelle ein neues Video, um zu beginnen.",
    goToTools: "Zu den Tools"
  },
  fr: {
    loginGoogle: "Se connecter avec Google",
    continueAsGuest: "Continuer comme invité",
    saveProgressTitle: "Ne perdez pas votre travail !",
    saveProgressDesc: "Connectez-vous avec Google en quelques secondes pour sauvegarder vos progrès, vos paramètres et gagner des points de récompense.",
    myProjects: "Mes Projets",
    projectsDesc: "Tous vos brouillons de vidéos passés sont stockés ici en toute sécurité.",
    rewardPoints: "Points",
    logout: "Se déconnecter",
    noProjectsTitle: "Aucun projet pour l'instant",
    noProjectsDesc: "Créez une nouvelle vidéo pour commencer.",
    goToTools: "Aller aux outils"
  },
  es: {
    loginGoogle: "Iniciar sesión con Google",
    continueAsGuest: "Continuar como invitado",
    saveProgressTitle: "¡No pierdas tu trabajo!",
    saveProgressDesc: "Inicia sesión con Google en segundos para guardar tu progreso, configuración y ganar puntos de recompensa.",
    myProjects: "Mis Proyectos",
    projectsDesc: "Todos los borradores de tus videos anteriores se almacenan de forma segura aquí.",
    rewardPoints: "Puntos",
    logout: "Cerrar sesión",
    noProjectsTitle: "Aún no hay proyectos",
    noProjectsDesc: "Crea un nuevo video para comenzar.",
    goToTools: "Ir a las herramientas"
  },
  zh: {
    loginGoogle: "使用 Google 登录",
    continueAsGuest: "以访客身份继续",
    saveProgressTitle: "不要丢失您的工作！",
    saveProgressDesc: "只需几秒钟即可使用 Google 登录，以保存您的进度、设置并赚取奖励积分。",
    myProjects: "我的项目",
    projectsDesc: "您过去的所有视频草稿都安全地存储在这里。",
    rewardPoints: "积分",
    logout: "登出",
    noProjectsTitle: "暂无项目",
    noProjectsDesc: "创建一个新视频开始吧。",
    goToTools: "前往工具"
  }
};

let modifiedContent = content;

for (const [lang, keys] of Object.entries(translations)) {
  const regex = new RegExp(`^  "${lang}": \\{`, 'm');
  
  let injectionStr = `  "${lang}": {\n`;
  for (const [k, v] of Object.entries(keys)) {
    injectionStr += `    ${k}: "${v}",\n`;
  }
  
  modifiedContent = modifiedContent.replace(regex, injectionStr);
}

fs.writeFileSync('src/lib/i18n.js', modifiedContent, 'utf8');
console.log("Translations added.");
