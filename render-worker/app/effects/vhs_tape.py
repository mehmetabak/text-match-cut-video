import numpy as np
from moviepy.editor import VideoFileClip, ImageClip
import os

# --- Pre-generated noise mask (O(1) per frame) ---
# Tek seferlik 2000x2000 gürültü haritası üret. Her karede rastgele offset'li slice al.
_NOISE_POOL_SIZE = 2000
_NOISE_POOL = np.random.randint(-14, 14, (_NOISE_POOL_SIZE, _NOISE_POOL_SIZE, 1), dtype=np.int16)
_rng = np.random.RandomState(42)

def _vhs_frame_transform(frame: np.ndarray, shift_px: int) -> np.ndarray:
    h, w = frame.shape[:2]
    
    # 1) Chromatic aberration: R kanalını sola, B kanalını sağa kaydır
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    
    # RAM dostu olması için in-place işlemler yapıyoruz
    out = np.empty(frame.shape, dtype=np.int16)
    out[:, :, 0] = r
    out[:, :, 1] = g
    out[:, :, 2] = b

    # 2) Scanline: çift satırları hafifçe karart
    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)

    # 3) Noise (karlanma): pre-generated havuzdan rastgele dilim al (O(1))
    y_off = _rng.randint(0, _NOISE_POOL_SIZE - h)
    x_off = _rng.randint(0, _NOISE_POOL_SIZE - w)
    noise = _NOISE_POOL[y_off:y_off + h, x_off:x_off + w, :]
    out += noise

    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8)


def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")


def apply_vhs_tape(input_path: str, output_path: str,
                    duration: float = None, aberration_strength: float = 1.0,
                    hd_output: bool = False,
                    aspect_ratio: str = "16:9"):
    is_img = _is_image(input_path)
    
    # Hedef çözünürlük: Pro=1080p, Free=720p
    target_h = 1080 if hd_output else 720
    
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        # FFMPEG Native Downscale: Video Python'a ulaşmadan küçültülür → okuma ~2.5x hızlanır
        clip = VideoFileClip(input_path, target_resolution=(target_h, None))
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
    
    # Aspect ratio uygulaması
    if aspect_ratio == "9:16":
        target_w = int(target_h * 9 / 16)
    elif aspect_ratio == "1:1":
        target_w = target_h
    else:  # 16:9 (varsayılan)
        target_w = int(target_h * 16 / 9)
    
    # Boyutlandırma
    if clip.h != target_h:
        clip = clip.resize(height=target_h)
    
    # Aspect ratio crop/pad
    if clip.w != target_w:
        if clip.w > target_w:
            # Ortadan kırp
            x_start = (clip.w - target_w) // 2
            clip = clip.crop(x1=x_start, x2=x_start + target_w)
        else:
            # Letterbox (siyah çerçeve)
            clip = clip.margin(left=(target_w - clip.w) // 2, right=(target_w - clip.w + 1) // 2, color=(0, 0, 0))
    
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
        logger=None,
        ffmpeg_params=["-crf", "23", "-movflags", "+faststart"],
    )

    clip.close()
    processed.close()
