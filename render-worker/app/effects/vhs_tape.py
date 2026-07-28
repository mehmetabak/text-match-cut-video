import os
import numpy as np
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

# --- O(1) Pre-Generated Noise Mask ---
# Her karede yeniden np.random.randint çağırmak yerine,
# tek seferlik büyük bir gürültü haritası oluşturuyoruz.
# Her kare için bu haritadan rastgele offset'li bir dilim (slice) alınır.
_NOISE_MAP_SIZE = 2048
_noise_map = np.random.randint(-14, 14, (_NOISE_MAP_SIZE, _NOISE_MAP_SIZE, 1), dtype=np.int16)


def _vhs_frame_transform(frame: np.ndarray, shift_px: int) -> np.ndarray:
    h, w = frame.shape[:2]
    
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

    # 3) O(1) Noise: pre-generated haritadan rastgele dilim al
    y_off = np.random.randint(0, _NOISE_MAP_SIZE - h)
    x_off = np.random.randint(0, _NOISE_MAP_SIZE - w)
    noise_slice = _noise_map[y_off:y_off + h, x_off:x_off + w]
    out += noise_slice

    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8)


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


def apply_vhs_tape(input_path: str, output_path: str,
                    duration: float = None, aberration_strength: float = 1.0,
                    hd_output: bool = False, aspect_ratio: str = "16:9"):
    is_img = _is_image(input_path)
    
    # Çıktı çözünürlüğünü belirle
    presets = _FORMAT_PRESETS_HD if hd_output else _FORMAT_PRESETS
    target_w, target_h = presets.get(aspect_ratio, presets["16:9"])
    
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        # FFMPEG Native Downscale: Python'a ulaşmadan önce C-tabanlı küçültme
        clip = VideoFileClip(input_path, target_resolution=(target_h, None))
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
            
    # Hedef çözünürlüğe göre resize (aspect ratio uygulaması)
    clip = clip.resize(newsize=(target_w, target_h))
    
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
        ffmpeg_params=["-crf", "23", "-movflags", "faststart"],
    )

    clip.close()
    processed.close()
