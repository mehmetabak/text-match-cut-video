const fs = require('fs');
const content = fs.readFileSync('src/lib/i18n.js', 'utf8');

const translations = {
  en: { heroTrust1: "No Watermark", heroTrust2: "HD Export", heroTrust3: "100% Free" },
  tr: { heroTrust1: "Filigran Yok", heroTrust2: "HD Dışa Aktarım", heroTrust3: "%100 Ücretsiz" },
  de: { heroTrust1: "Kein Wasserzeichen", heroTrust2: "HD-Export", heroTrust3: "100% Kostenlos" },
  fr: { heroTrust1: "Sans Filigrane", heroTrust2: "Exportation HD", heroTrust3: "100% Gratuit" },
  es: { heroTrust1: "Sin Marca de Agua", heroTrust2: "Exportación HD", heroTrust3: "100% Gratis" },
  zh: { heroTrust1: "无水印", heroTrust2: "高清导出", heroTrust3: "100% 免费" },
  ar: { heroTrust1: "بدون علامة مائية", heroTrust2: "تصدير عالي الدقة", heroTrust3: "مجاني 100%" },
  hi: { heroTrust1: "कोई वॉटरमार्क नहीं", heroTrust2: "एचडी निर्यात", heroTrust3: "100% मुफ़्त" },
  pt: { heroTrust1: "Sem Marca D'água", heroTrust2: "Exportação HD", heroTrust3: "100% Grátis" },
  ru: { heroTrust1: "Без водяных знаков", heroTrust2: "HD-экспорт", heroTrust3: "100% бесплатно" },
  ja: { heroTrust1: "透かしなし", heroTrust2: "HD出力", heroTrust3: "完全無料" },
  ko: { heroTrust1: "워터마크 없음", heroTrust2: "HD 내보내기", heroTrust3: "100% 무료" },
  it: { heroTrust1: "Senza Filigrana", heroTrust2: "Esportazione HD", heroTrust3: "100% Gratis" },
  nl: { heroTrust1: "Geen Watermerk", heroTrust2: "HD Export", heroTrust3: "100% Gratis" }
};

let updatedContent = content;

Object.keys(translations).forEach(lang => {
  const vals = translations[lang];
  if (!vals) return;
  const regex = new RegExp(`("${lang}":\\s*{[\\s\\S]*?"heroCTA":\\s*"[^"]*",?)`);
  const match = updatedContent.match(regex);
  if (match) {
    const replacement = `${match[1]}\n    "heroTrust1": "${vals.heroTrust1}",\n    "heroTrust2": "${vals.heroTrust2}",\n    "heroTrust3": "${vals.heroTrust3}",`;
    updatedContent = updatedContent.replace(regex, replacement);
  }
});

fs.writeFileSync('src/lib/i18n.js', updatedContent);
console.log('Updated i18n.js successfully!');
