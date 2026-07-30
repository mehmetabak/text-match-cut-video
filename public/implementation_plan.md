# System Robustness, New Features & UI/UX Optimization Plan

Bu plan, mevcut çalışan yapıyı bozmadan güvenlik, stabilite, hız optimizasyonları ve yeni özellikleri entegre etmek üzere hazırlanmıştır.

> [!IMPORTANT]
> - Girdi doğrulaması (ffprobe vb.) kaldırıldı — RAM yemesin.
> - Progress bar tamamen frontend-simülasyonu olacak — backend `subprocess.run` yapısına dokunulmayacak.
> - Lütfen inceleyip onaylayın (Proceed).

## Proposed Changes

---

### 1. Architectural & Stability Fixes (`main.py`)

Mevcut `subprocess.run` ve `worker_lock` yapısına dokunmadan, sadece kuyruk döngüsünü sağlamlaştırıyoruz.

#### [MODIFY] [main.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/main.py)
- **Tam İzole `try/except`:** `process_queue()` içindeki `while True` döngüsünde her job'ı ayrı `try...except Exception` bloğuna alacağız. Tek bir bozuk job tüm kuyruğu durduramayacak.
- **Akıllı `/tmp` Temizliği:** İşlem **başarılı** → `input_path` anında silinecek. İşlem **başarısız** → dosya silinmeyecek (debugging için). Mevcut `cleanup_orphans` fonksiyonu 2 saat sonra bu hatalı dosyaları otomatik temizleyecek.
- **`job_id` Sanitizasyonu:** `glob.glob` öncesi `job_id`'nin sadece hex karakterler (UUID formatı) içerdiği regex ile doğrulanacak. Path traversal / joker karakter saldırılarını önleyecek.
- **Auto-Retry:** `run_isolated_job` başarısız dönerse ve `retry_count < 2` ise, job tekrar `pending` yapılacak.

> [!NOTE]
> `subprocess.run`, `worker_lock`, `run_isolated_job` ve `process_queue` iskeletine dokunulmayacak. Sadece döngü içi hata yönetimi ve temizlik ekleniyor.

---

### 2. Kalite Kayıpsız Gerçek Hız Optimizasyonları (Hem VHS Hem Ken Burns)

CRF değerine dokunmadan, algoritmik darboğazları çözerek işlem süresini en az 2 kat hızlandırıyoruz.

#### [MODIFY] [vhs_tape.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/effects/vhs_tape.py)
- **FFMPEG Native Downscale:** `VideoFileClip(path, target_resolution=(720, None))` kullanılarak video Python'a ulaşmadan önce C-native olarak küçültülecek. Python'a aktarılan piksel verisi %50+ azalacak → okuma hızı ~2.5x artacak.
- **O(1) Pre-Generated Noise Mask:** Her kare için `np.random.randint` çağırmak yerine, fonksiyon başında tek seferlik 2000×2000 piksellik bir gürültü haritası üretilecek. Her karede bu haritadan rastgele offset'li bir dilim (slice) alınacak → **kare başı CPU yükü ~3x azalacak.**
- **`-movflags faststart`:** Üretilen MP4'ün meta verisi dosya başına taşınacak → kullanıcı indirme bitmeden oynatmaya başlayabilecek.

#### [MODIFY] [ken_burns.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/effects/ken_burns.py)
- **FFMPEG Native Downscale:** Video girdisi için aynı `target_resolution` optimizasyonu uygulanacak. Büyük videolar Python'a küçültülmüş olarak gelecek → her karedeki Pillow `.resize()` çok daha az piksel işleyecek → ~2x hızlanma.
- **Pillow Obje Yeniden Kullanımı:** Ardışık karelerde crop boyutu değişmediyse `Image.fromarray` tekrar çağrılmayacak, mevcut PIL buffer'ı yeniden kullanılacak → GC (Garbage Collector) yükü azalacak.
- **`-movflags faststart`:** VHS ile aynı streaming optimizasyonu.

> [!NOTE]
> `crf` değeri 23'te kalacak — kaliteden ödün verilmeyecek. Tüm hızlanma tamamen algoritmik.

---

### 3. 1080p Pro Çıktı Seçeneği

Pro kullanıcılar 1080p (Full HD) çıktı alabilecek, normal kullanıcılar 720p ile devam edecek.

#### [MODIFY] [VideoEffectTool.jsx](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/src/pages/VideoEffectTool.jsx)
- Hem Ken Burns hem VHS ayarlarının altına **"1080p HD Çıktı (Pro)"** toggle switch eklenecek. Varsayılan: kapalı (720p).
- Toggle açıldığında altında uyarı notu belirecek: *"⚠️ 1080p çıktı daha yavaş sürer"*
- Toggle durumu `hd_output: true/false` olarak Firestore'daki job params'ına yazılacak.

#### [MODIFY] [ken_burns.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/effects/ken_burns.py) & [vhs_tape.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/effects/vhs_tape.py)
- `hd_output` parametresi eklenecek (varsayılan `False`).
- `hd_output=True` → VHS: `resize(height=1080)`, Ken Burns: `target 1920×1080`.
- `hd_output=False` → Mevcut 720p davranışı (hızlı işlem).

---

### 4. Simüle Edilmiş Progress Bar (Backend'e Dokunmadan)

Mevcut `subprocess.run` yapısını bozmadan, tamamen frontend tarafında çalışan animasyonlu ilerleme çubuğu.

#### [MODIFY] [VideoEffectTool.jsx](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/src/pages/VideoEffectTool.jsx)
- Frontend, Firestore'daki **mevcut `status` alanını** (`pending`, `processing`, `completed`, `failed`) `onSnapshot` ile dinlemeye devam edecek (zaten yapıyoruz).
- Progress bar davranışı:
  | Firestore Status | Progress Bar |
  |---|---|
  | `pending` | **%1'de sabit** (bekliyor) |
  | `processing` | Zamana dayalı simülasyonla yavaşça %1 → %85 arası dolacak (ör. saniyede +1-2%) |
  | `completed` | Anında **%100'e** zıplayıp başarı animasyonu gösterecek |
  | `failed` | Kırmızıya dönüp hata mesajı gösterecek |
- Bar asla %85'i geçmeyecek (backend'den `completed` gelmeden). Böylece "takıldı mı?" hissi olmayacak.
- Tasarım: Animaker temasına uyumlu glassmorphism bar, neon gradient dolgu, yumuşak `transition` animasyonu.

> [!NOTE]
> Backend'e (`main.py`, `job_runner.py`, `subprocess.run`) hiçbir değişiklik yapılmayacak. Progress bar tamamen frontend simülasyonu.

---

### 5. Yeni Ken Burns Parametreleri ve UI Entegrasyonu

#### [MODIFY] [ken_burns.py](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/render-worker/app/effects/ken_burns.py)
- `zoom_direction` (`in`, `out`) ve `pan_style` (`center`, `left_to_right`, `right_to_left`, `bottom_to_top`, `top_to_bottom`) parametreleri eklenecek.
- `_make_zoom_frame_func` algoritması `pan_style`'a göre x,y merkezini zaman içinde kaydıracak. `zoom_direction='out'` ise scale tersine çevrilecek.

#### [MODIFY] [VideoEffectTool.jsx](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/src/pages/VideoEffectTool.jsx)
- Seçilen efekte göre pürüzsüz açılır/kapanır ayar menüleri:
  1. **Video Formatı (Her İkisi):** 16:9 (Yatay), 9:16 (Dikey), 1:1 (Kare).
  2. **Yakınlaştırma (Sadece Ken Burns):** İçeri, Dışarı.
  3. **Kamera Yönü (Sadece Ken Burns):** Merkez, Soldan Sağa, Aşağıdan Yukarı vb.
  4. **1080p HD Çıktı (Pro):** Toggle + uyarı notu.
- UI: Karanlık tema, gradient kenarlıklar, glassmorphism cam efekti.

---

### 6. Mobil Uyumluluk (Responsive & iOS Safari)

#### [MODIFY] `index.css` & [VideoEffectTool.jsx](file:///c:/Users/Mehmet/Desktop/Pr0jeler/WEB/video-web/text-match-cut-video/src/pages/VideoEffectTool.jsx)
- **iOS Safari `100vh` Hatası:** `100dvh` veya `min-height` ile çözülecek.
- **Mobil Düzen:** Ayar menüleri, butonlar ve preview kutuları mobilde alt alta dizilecek, dokunma alanları min 44×44px olacak.
- **Yatay Taşma:** `overflow-x: hidden` ve uygun padding kontrolü.

---

## Özet Tablo

| Değişiklik | Dosya(lar) | Backend Değişir mi? |
|---|---|---|
| İzole try/except, sanitize | `main.py` | ✅ Evet (sadece hata yönetimi) |
| Akıllı /tmp temizliği | `main.py` | ✅ Evet (sadece cleanup mantığı) |
| Auto-retry (max 2) | `main.py` | ✅ Evet (retry_count ekleniyor) |
| FFMPEG native downscale | `vhs_tape.py`, `ken_burns.py` | ✅ Evet (VideoFileClip parametresi) |
| Pre-generated noise mask | `vhs_tape.py` | ✅ Evet (numpy optimizasyonu) |
| Pillow resize cache | `ken_burns.py` | ✅ Evet (PIL obje yeniden kullanımı) |
| `-movflags faststart` | `vhs_tape.py`, `ken_burns.py` | ✅ Evet (ffmpeg parametresi) |
| 1080p Pro toggle | `VideoEffectTool.jsx`, her iki efekt | ✅ Evet (hd_output parametresi) |
| Simüle progress bar | `VideoEffectTool.jsx` | ❌ **Hayır** |
| Ken Burns pan/zoom | `ken_burns.py`, `VideoEffectTool.jsx` | ✅ Evet (yeni parametreler) |
| Format presetleri | Her iki efekt, `VideoEffectTool.jsx` | ✅ Evet (target boyut) |
| Mobil & iOS uyumluluk | `index.css`, `VideoEffectTool.jsx` | ❌ **Hayır** |

## Verification Plan

- VHS ve Ken Burns'ün hız optimizasyonlarıyla en az 2x hızlandığı kıyaslamalı test edilecek.
- 1080p toggle açıkken çıktının 1920×1080, kapalıyken 1280×720 olduğu kontrol edilecek.
- Simüle progress barın `processing` → yavaş dolma → `completed` → %100 zıplama akışı test edilecek.
- İşlem başarısız olduğunda dosyanın silinmediği, başarılı olduğunda silindiği test edilecek.
- Safari ve Chrome (DevTools, iPhone SE & 14 Pro) ile mobil UI kontrol edilecek.
