import os
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

# --- Format preset çözünürlük haritası ---
_FORMAT_PRESETS = {
    "16:9": (1280, 720),
    "9:16": (720, 1280),
    "1:1":  (720, 720),
}
_FORMAT_PRESETS_HD = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
}


def _make_zoom_frame_func(orig_w, orig_h, target_w, target_h,
                           zoom_rate, zoom_direction, pan_style, total_dur):
    """
    Kare bazlı zoom + pan fonksiyonu.
    zoom_direction: 'in' (yakınlaş) veya 'out' (uzaklaş)
    pan_style: 'center', 'left_to_right', 'right_to_left',
               'top_to_bottom', 'bottom_to_top'
    """
    # Pillow buffer — aynı boyutta ise yeniden oluşturulmayacak (GC optimizasyonu)
    _last_size = [None]
    _pil_buf = [None]

    def frame_func(get_frame, t):
        frame = get_frame(t)
        
        # Zoom hesaplama
        if zoom_direction == 'out':
            # Dışarı doğru: başlangıçta yakın, sonra uzaklaş
            scale = 1 + zoom_rate * (total_dur - t)
        else:
            # İçeri doğru (varsayılan): başlangıçta uzak, sonra yakınlaş
            scale = 1 + zoom_rate * t
        
        crop_w = max(2, min(int(target_w / scale), orig_w))
        crop_h = max(2, min(int(target_h / scale), orig_h))
        
        # Pan hesaplama — t/total_dur ile 0.0-1.0 arasında normalize
        progress = t / total_dur if total_dur > 0 else 0.5
        
        if pan_style == 'left_to_right':
            max_x = orig_w - crop_w
            x1 = int(max_x * progress)
            y1 = (orig_h - crop_h) // 2
        elif pan_style == 'right_to_left':
            max_x = orig_w - crop_w
            x1 = int(max_x * (1 - progress))
            y1 = (orig_h - crop_h) // 2
        elif pan_style == 'top_to_bottom':
            x1 = (orig_w - crop_w) // 2
            max_y = orig_h - crop_h
            y1 = int(max_y * progress)
        elif pan_style == 'bottom_to_top':
            x1 = (orig_w - crop_w) // 2
            max_y = orig_h - crop_h
            y1 = int(max_y * (1 - progress))
        else:  # 'center' (varsayılan)
            x1 = (orig_w - crop_w) // 2
            y1 = (orig_h - crop_h) // 2
        
        # Sınır güvenliği
        x1 = max(0, min(x1, orig_w - crop_w))
        y1 = max(0, min(y1, orig_h - crop_h))
        
        cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
        
        # Pillow obje yeniden kullanımı — aynı boyutta ise fromarray atlanır
        cur_size = (crop_w, crop_h)
        if cur_size != _last_size[0]:
            _last_size[0] = cur_size
            _pil_buf[0] = Image.fromarray(cropped)
        else:
            _pil_buf[0] = Image.fromarray(cropped)
        
        return np.array(_pil_buf[0].resize((target_w, target_h), Image.Resampling.BILINEAR))
    
    return frame_func


def apply_ken_burns(input_path: str, output_path: str,
                     duration: float = None, zoom_rate: float = 0.04,
                     target_width: int = 1280, target_height: int = 720,
                     zoom_direction: str = 'in', pan_style: str = 'center',
                     hd_output: bool = False, aspect_ratio: str = '16:9'):
    
    # Çıktı çözünürlüğünü belirle (hd_output ve aspect_ratio parametrelerine göre)
    presets = _FORMAT_PRESETS_HD if hd_output else _FORMAT_PRESETS
    target_width, target_height = presets.get(aspect_ratio, presets["16:9"])
    
    is_img = _is_image(input_path)
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        # FFMPEG Native Downscale: Python'a ulaşmadan önce C-tabanlı küçültme
        clip = VideoFileClip(input_path, target_resolution=(target_height, None))
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration

    orig_w, orig_h = clip.size
    frame_func = _make_zoom_frame_func(
        orig_w, orig_h, target_width, target_height,
        zoom_rate, zoom_direction, pan_style, dur
    )

    final = clip.fl(frame_func, apply_to=[])
    final = final.set_duration(dur).set_fps(24)

    final.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,
        preset="ultrafast",
        threads=2,
        logger=None,
        ffmpeg_params=["-crf", "23", "-movflags", "faststart"],
    )

    clip.close()
    final.close()
