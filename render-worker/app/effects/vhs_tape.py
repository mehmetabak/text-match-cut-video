import numpy as np
from moviepy.editor import VideoFileClip, ImageClip

def _vhs_frame_transform(frame: np.ndarray, shift_px: int) -> np.ndarray:
    # 1) Chromatic aberration: R kanalını sola, B kanalını sağa kaydır
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    out = np.stack([r, g, b], axis=2).astype(np.int16)

    # 2) Scanline: çift satırları hafifçe karart
    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)

    # 3) Noise (karlanma): hafif rastgele parlaklık gürültüsü
    noise = np.random.randint(-14, 14, (frame.shape[0], frame.shape[1], 1))
    out = out + noise

    return np.clip(out, 0, 255).astype(np.uint8)

import os

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def apply_vhs_tape(input_path: str, output_path: str,
                    duration: float = None, aberration_strength: float = 1.0):
    is_img = _is_image(input_path)
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
    else:
        clip = VideoFileClip(input_path)
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
    
    shift_px = max(1, int(clip.w * 0.003 * aberration_strength))

    processed = clip.fl_image(lambda frame: _vhs_frame_transform(frame, shift_px))

    processed.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,
        preset="ultrafast",
        threads=2,
        logger=None,
        ffmpeg_params=["-crf", "23"],
    )

    clip.close()
    processed.close()
