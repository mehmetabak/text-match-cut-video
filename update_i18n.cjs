const fs = require('fs');
let content = fs.readFileSync('src/lib/i18n.js', 'utf8');
const translations = {
  en: { tryNowButton: 'Try Now' },
  tr: { tryNowButton: 'Hemen Dene' },
  de: { tryNowButton: 'Jetzt testen' },
  fr: { tryNowButton: 'Essayer' },
  es: { tryNowButton: 'Pruébalo ahora' },
  zh: { tryNowButton: '立即体验' },
  ar: { tryNowButton: 'جرب الآن' },
  ko: { tryNowButton: '지금 시도' },
  ja: { tryNowButton: '今すぐ試す' },
  id: { tryNowButton: 'Coba Sekarang' },
  th: { tryNowButton: 'ลองเลย' },
  hi: { tryNowButton: 'अभी आज़माएं' },
  ru: { tryNowButton: 'Попробовать' },
  pt: { tryNowButton: 'Teste Agora' }
};

for (const lang in translations) {
  const marker = "supportEmailText: '";
  const regex = new RegExp(`(${lang}: \\{[\\s\\S]*?${marker}[^']+')(,|\\n)`);
  if (regex.test(content)) {
    content = content.replace(regex, `$1, tryNowButton: '${translations[lang].tryNowButton}'$2`);
  } else {
    console.log("Could not match language:", lang);
  }
}
fs.writeFileSync('src/lib/i18n.js', content);
console.log("Done");
