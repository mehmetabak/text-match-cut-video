import os
import numpy as np
from moviepy.editor import VideoFileClip, ImageClip

# Pre-generate a huge noise mask once (O(1) allocation)
NOISE_MAP_SIZE = 2500
PRE_GENERATED_NOISE = np.random.randint(-14, 14, (NOISE_MAP_SIZE, NOISE_MAP_SIZE, 1), dtype=np.int16)

def _vhs_frame_transform(frame: np.ndarray, shift_px: int) -> np.ndarray:
    h, w, _ = frame.shape
    
    # 1) Chromatic aberration
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    
    out = np.empty(frame.shape, dtype=np.int16)
    out[:, :, 0] = r
    out[:, :, 1] = g
    out[:, :, 2] = b

    # 2) Scanline
    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)

    # 3) O(1) Noise: Sample a random slice from PRE_GENERATED_NOISE
    # Make sure we don't go out of bounds
    max_x = max(0, NOISE_MAP_SIZE - h - 1)
    max_y = max(0, NOISE_MAP_SIZE - w - 1)
    offset_x = np.random.randint(0, max_x + 1)
    offset_y = np.random.randint(0, max_y + 1)
    
    noise_slice = PRE_GENERATED_NOISE[offset_x:offset_x+h, offset_y:offset_y+w, :]
    out += noise_slice

    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8)

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def apply_vhs_tape(input_path: str, output_path: str,
                    duration: float = None, aberration_strength: float = 1.0, hd_output: bool = False, **kwargs):
    is_img = _is_image(input_path)
    target_h = 1080 if hd_output else 720
    
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
        if clip.h > target_h:
            clip = clip.resize(height=target_h)
    else:
        clip = VideoFileClip(input_path)
        if clip.h > target_h:
            clip = clip.resize(height=target_h)
            
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
            
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
