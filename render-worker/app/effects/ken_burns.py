import os
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def _make_zoom_frame_func(orig_w, orig_h, target_w, target_h, zoom_rate):
    """
    Kare bazlı merkezden zoom fonksiyonu.
    Sabit çıktı boyutu ve güvenli merkezleme sağlar.
    """
    def frame_func(get_frame, t):
        frame = get_frame(t)
        scale = 1 + zoom_rate * t
        crop_w = max(2, min(int(target_w / scale), orig_w))
        crop_h = max(2, min(int(target_h / scale), orig_h))
        x1 = (orig_w - crop_w) // 2
        y1 = (orig_h - crop_h) // 2
        cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
        
        # OOM hatasına yol açan cv2 yerine, hafif Pillow kütüphanesi kullanıyoruz:
        pil_img = Image.fromarray(cropped)
        # Resize yap ve tekrar numpy dizisine çevir (MoviePy bunu bekler)
        return np.array(pil_img.resize((target_w, target_h), Image.Resampling.BILINEAR))
    return frame_func

def apply_ken_burns(input_path: str, output_path: str,
                     duration: float = None, zoom_rate: float = 0.04,
                     target_width: int = 1280, target_height: int = 720):
    is_img = _is_image(input_path)
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        clip = VideoFileClip(input_path)
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration

    orig_w, orig_h = clip.size
    frame_func = _make_zoom_frame_func(orig_w, orig_h, target_width, target_height, zoom_rate)

    final = clip.fl(frame_func, apply_to=[])
    final = final.set_duration(dur).set_fps(24)

    final.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,          # görselde ses yok
        preset="ultrafast",          # RAM/CPU tasarrufu
        threads=2,
        logger=None,                 # tqdm/ilerleme çubuğu overhead'ini kapat
        ffmpeg_params=["-crf", "23"],
    )

    clip.close()
    final.close()
