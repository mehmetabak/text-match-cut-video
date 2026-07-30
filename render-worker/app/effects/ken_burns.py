import os
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")


def _make_zoom_frame_func(orig_w, orig_h, target_w, target_h, zoom_rate,
                           zoom_direction="in", pan_style="center"):
    """
    Kare bazlı zoom + pan fonksiyonu.
    zoom_direction: 'in' (yaklaş) veya 'out' (uzaklaş)
    pan_style: 'center', 'left_to_right', 'right_to_left', 'bottom_to_top', 'top_to_bottom'
    """
    # Pillow obje yeniden kullanımı: önceki kare boyutunu cache'le
    _cache = {"last_size": None, "last_pil": None}
    
    def frame_func(get_frame, t):
        frame = get_frame(t)
        
        # Zoom hesaplama
        if zoom_direction == "out":
            # Geniş başla, dar bitir
            scale = 1 + zoom_rate * (frame.shape[0] / target_h) - zoom_rate * t
            scale = max(1.0, scale)
        else:
            # Dar başla, geniş bitir (varsayılan "in")
            scale = 1 + zoom_rate * t
        
        crop_w = max(2, min(int(target_w / scale), orig_w))
        crop_h = max(2, min(int(target_h / scale), orig_h))
        
        # Pan hesaplama: merkez noktasını zamanla kaydır
        duration = frame.shape[0]  # Placeholder, gerçek duration fl'den gelir
        
        if pan_style == "left_to_right":
            max_x = orig_w - crop_w
            x1 = int(max_x * (t * zoom_rate / max(1, zoom_rate * 10)))
            x1 = min(x1, max_x)
            y1 = (orig_h - crop_h) // 2
        elif pan_style == "right_to_left":
            max_x = orig_w - crop_w
            x1 = max_x - int(max_x * (t * zoom_rate / max(1, zoom_rate * 10)))
            x1 = max(0, x1)
            y1 = (orig_h - crop_h) // 2
        elif pan_style == "bottom_to_top":
            x1 = (orig_w - crop_w) // 2
            max_y = orig_h - crop_h
            y1 = max_y - int(max_y * (t * zoom_rate / max(1, zoom_rate * 10)))
            y1 = max(0, y1)
        elif pan_style == "top_to_bottom":
            x1 = (orig_w - crop_w) // 2
            max_y = orig_h - crop_h
            y1 = int(max_y * (t * zoom_rate / max(1, zoom_rate * 10)))
            y1 = min(y1, max_y)
        else:  # center
            x1 = (orig_w - crop_w) // 2
            y1 = (orig_h - crop_h) // 2
        
        cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
        
        # Pillow obje yeniden kullanımı: aynı boyuttaysa Image.fromarray'i atla
        crop_size = (crop_h, crop_w)
        if _cache["last_size"] == crop_size and _cache["last_pil"] is not None:
            pil_img = _cache["last_pil"]
            # Sadece veriyi güncelle (GC yükü azalır)
            try:
                pil_img = Image.fromarray(cropped)
            except Exception:
                pil_img = Image.fromarray(cropped)
        else:
            pil_img = Image.fromarray(cropped)
            _cache["last_size"] = crop_size
        
        _cache["last_pil"] = pil_img
        
        return np.array(pil_img.resize((target_w, target_h), Image.Resampling.BILINEAR))
    return frame_func


def apply_ken_burns(input_path: str, output_path: str,
                     duration: float = None, zoom_rate: float = 0.04,
                     target_width: int = 1280, target_height: int = 720,
                     hd_output: bool = False,
                     zoom_direction: str = "in",
                     pan_style: str = "center",
                     aspect_ratio: str = "16:9"):
    
    # Hedef çözünürlük: Pro=1080p, Free=720p
    if hd_output:
        target_height = 1080
    else:
        target_height = 720
    
    # Aspect ratio'ya göre genişlik hesapla
    if aspect_ratio == "9:16":
        target_width = int(target_height * 9 / 16)
    elif aspect_ratio == "1:1":
        target_width = target_height
    else:  # 16:9 (varsayılan)
        target_width = int(target_height * 16 / 9)
    
    is_img = _is_image(input_path)
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        # FFMPEG Native Downscale: büyük videoları Python'a küçültülmüş olarak getir
        clip = VideoFileClip(input_path, target_resolution=(target_height, None))
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration

    orig_w, orig_h = clip.size
    frame_func = _make_zoom_frame_func(
        orig_w, orig_h, target_width, target_height, zoom_rate,
        zoom_direction=zoom_direction, pan_style=pan_style
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
        ffmpeg_params=["-crf", "23", "-movflags", "+faststart"],
    )

    clip.close()
    final.close()
