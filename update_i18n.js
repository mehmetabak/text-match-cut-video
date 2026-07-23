const fs = require('fs');
let content = fs.readFileSync('src/lib/i18n.js', 'utf8');
const translations = {
  en: { layoutNavContact: 'Contact Us', supportEmailText: 'Support:' },
  tr: { layoutNavContact: 'Bize Ulaşın', supportEmailText: 'Destek:' },
  de: { layoutNavContact: 'Kontakt', supportEmailText: 'Support:' },
  fr: { layoutNavContact: 'Contactez-nous', supportEmailText: 'Support:' },
  es: { layoutNavContact: 'Contáctenos', supportEmailText: 'Soporte:' },
  zh: { layoutNavContact: '联系我们', supportEmailText: '支持:' },
  ar: { layoutNavContact: 'اتصل بنا', supportEmailText: 'الدعم:' },
  ko: { layoutNavContact: '문의하기', supportEmailText: '지원:' },
  ja: { layoutNavContact: 'お問い合わせ', supportEmailText: 'サポート:' },
  id: { layoutNavContact: 'Hubungi Kami', supportEmailText: 'Dukungan:' },
  th: { layoutNavContact: 'ติดต่อเรา', supportEmailText: 'สนับสนุน:' },
  hi: { layoutNavContact: 'संपर्क करें', supportEmailText: 'समर्थन:' },
  ru: { layoutNavContact: 'Свяжитесь с нами', supportEmailText: 'Поддержка:' },
  pt: { layoutNavContact: 'Contate-Nos', supportEmailText: 'Suporte:' }
};

for (const lang in translations) {
  const marker = "layoutMenu: '";
  const regex = new RegExp(`(${lang}: \\{[\\s\\S]*?${marker}[^']+')(,|\\n)`);
  if (regex.test(content)) {
    content = content.replace(regex, `$1, layoutNavContact: '${translations[lang].layoutNavContact}', supportEmailText: '${translations[lang].supportEmailText}'$2`);
  } else {
    console.log("Could not match language:", lang);
  }
}
fs.writeFileSync('src/lib/i18n.js', content);
console.log("Done");
