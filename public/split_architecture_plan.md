# İkili Mimari (Split Architecture) Planı: Hem AdSense Hem Yüksek Hız

Şu ana kadar web standartlarının gereği olarak bir seçim yapmamız gerektiğini konuşmuştuk. Ancak profesyonel bir mimari değişikliği ile **her iki dünyayı da** bir araya getirebiliriz!

Bunun için sitenizi **"Güvenli Bölge (Reklamlı)"** ve **"İzole Bölge (Araçlar)"** olmak üzere ikiye ayıracağız.

## 🎯 Ne Başaracağız?
1. **Ana Sayfa, Projeler, Hesap, Araçlar Listesi vb.:** Bu sayfalarda kalkan (COOP/COEP) **OLMAYACAK**. AdSense reklamlarınız, analiz araçlarınız ve normal işlevler %100 sorunsuz çalışacak.
2. **Video Araçları (Örn: `/match-cut`):** Kullanıcı bu araçlara girdiğinde, tarayıcı gizlice arka planda "İzole Moda" geçecek. Reklamlar devre dışı kalacak ama **Maksimum Performans (Çoklu-Çekirdek)** aktif olacak.

## ⚠️ Dikkat Edilmesi Gerekenler

Bu mimariyi kurabilmek için, "Araçlara giriş" ve "Araçlardan çıkış" anlarında React'ın yumuşak geçişi yerine **Sayfanın Hard-Refresh (Tamamen Yenilenmesi)** işlemini yapmamız gerekiyor.
Yani kullanıcı "Hemen Dene" butonuna bastığında sayfa (1 saniyeliğine) normal bir web sitesi gibi yüklenecek (React anında geçişi iptal edilecek). Bu, tarayıcının güvenlik duvarını açıp kapatabilmesi için zorunludur.

## 🛠️ Yapılacak Teknik Değişiklikler

### 1. Sunucu Ayarları (Vercel & Vite)
- `vercel.json` içindeki global COOP/COEP kuralları silinip, sadece `/(match-cut|effects/.*)` sayfalarında çalışacak şekilde kısıtlandırılacak.
- Yerel testler için `vite.config.js` dosyasına özel bir eklenti (plugin) yazılacak ve güvenlik kalkanı sadece araç sayfalarına uygulanacak.

### 2. Navigasyon (Yönlendirme) Düzenlemeleri
- **`Layout.jsx` (Üst Menü):** Kullanıcı bir araçtayken logoya veya "Projelerim" linkine tıklarsa, React Router yerine doğrudan `window.location.href` ile dışarı atılacak (kalkanın kapanması için).
- **`Tools.jsx` (Araç Listesi):** Kullanıcı bir aracın kartına tıkladığında, `navigate` yerine tam sayfa yenilemesi ile araca yönlendirilecek.
- **`Home.jsx`:** Ana sayfadaki tüm "Dene" butonları da aynı şekilde tam sayfa yönlendirmesiyle çalışacak.

## 🧪 Doğrulama Planı
1. Ana sayfada `Cross-Origin-Opener-Policy` başlığının OLMADIĞINI (AdSense'in çalışabildiğini) teyit etmek.
2. `/match-cut` sayfasına girildiğinde başlıkların EKLENDİĞİNİ ve FFmpeg'in çoklu-çekirdekle (SharedArrayBuffer) yüklendiğini test etmek.
3. Araç sayfasından ana sayfaya dönerken oturumun (login state) kopmadığını test etmek.
