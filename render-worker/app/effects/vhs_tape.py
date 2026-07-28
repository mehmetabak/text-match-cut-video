import numpy as np
import os
from moviepy.editor import VideoFileClip, ImageClip
import PIL.Image

# Yavaş olan LANCZOS (eski ANTIALIAS) yerine hızlı olan BILINEAR kullanıyoruz (Müthiş hız farkı yaratır)
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.Resampling.BILINEAR

# O(1) Pre-Generated Noise Mask for True Speed Optimization
# Generating 2000x2000 noise once takes minimal memory but saves hundreds of millions of CPU cycles per video.
PREGEN_NOISE = np.random.randint(-14, 14, size=(2000, 2000, 1), dtype=np.int16)

def _vhs_frame_transform(frame: np.ndarray, shift_px: int) -> np.ndarray:
    # 1) Chromatic aberration: R kanalını sola, B kanalını sağa kaydır
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    
    # RAM dostu in-place işlemler
    out = np.empty(frame.shape, dtype=np.int16)
    out[:, :, 0] = r
    out[:, :, 1] = g
    out[:, :, 2] = b

    # 2) Scanline: çift satırları hafifçe karart
    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)

    # 3) Noise (karlanma): O(1) Slice from Pre-generated map
    h, w = frame.shape[:2]
    max_y = PREGEN_NOISE.shape[0] - h
    max_x = PREGEN_NOISE.shape[1] - w
    
    if max_y > 0 and max_x > 0:
        ry = np.random.randint(0, max_y)
        rx = np.random.randint(0, max_x)
        noise = PREGEN_NOISE[ry:ry+h, rx:rx+w]
        out += noise

    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8)

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def apply_vhs_tape(input_path: str, output_path: str,
                    duration: float = None, aberration_strength: float = 1.0,
                    quality: str = "720p", aspect_ratio: str = "16:9", logger=None, **kwargs):
    is_img = _is_image(input_path)
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        clip = VideoFileClip(input_path)
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
            
    # Hedef Çözünürlük ve Format
    if quality == "1080p":
        max_dim, min_dim = 1920, 1080
    else:
        max_dim, min_dim = 1280, 720
        
    if aspect_ratio == "16:9":
        target_w, target_h = max_dim, min_dim
    elif aspect_ratio == "9:16":
        target_w, target_h = min_dim, max_dim
    elif aspect_ratio == "1:1":
        target_w, target_h = min_dim, min_dim
    else:
        target_w, target_h = max_dim, min_dim

    # Aspect Ratio Crop & Resize
    clip_ratio = clip.w / clip.h
    target_ratio = target_w / target_h
    
    # EĞER ÇÖZÜNÜRLÜK BİREBİR AYNI DEĞİLSE RESIZE YAP (Eğer aynıysa resize'ı atla, yoksa aşırı yavaşlar)
    if clip.w != target_w or clip.h != target_h:
        if abs(clip_ratio - target_ratio) > 0.01:
            if clip_ratio > target_ratio:
                # Video is wider, resize to match height, then crop sides
                clip = clip.resize(height=target_h)
                clip = clip.crop(x_center=clip.w/2, width=target_w)
            else:
                # Video is taller, resize to match width, then crop top/bottom
                clip = clip.resize(width=target_w)
                clip = clip.crop(y_center=clip.h/2, height=target_h)
        else:
            clip = clip.resize(width=target_w, height=target_h)
    
    shift_px = max(1, int(clip.w * 0.003 * aberration_strength))

    processed = clip.fl_image(lambda frame: _vhs_frame_transform(frame, shift_px))

    if is_img and getattr(processed, 'fps', None) is None:
        processed = processed.set_fps(24)

    processed.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,
        preset="ultrafast",
        threads=2,
        logger=logger,
        ffmpeg_params=["-crf", "23", "-movflags", "faststart"],
    )

    clip.close()
    processed.close()
