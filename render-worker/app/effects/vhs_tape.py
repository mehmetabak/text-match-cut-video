import os
import numpy as np
from PIL import Image

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def _clamp(value, lo, hi, default):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))

def _make_scanline_overlay(path: str, width: int, height: int, opacity: int = 60):
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[::2, :, 3] = opacity
    Image.fromarray(arr, "RGBA").save(path)

def build_vhs_tape_cmd(input_path: str, output_path: str, scanline_path: str,
                        duration=None, aberration_strength=1.0, noise_amount=15,
                        target_width=1280, target_height=720):
    is_img = _is_image(input_path)
    dur = _clamp(duration, 1, 210, 8.0)
    strength = _clamp(aberration_strength, 0.0, 3.0, 1.0)
    noise_amt = int(_clamp(noise_amount, 0, 40, 15))
    tw = int(_clamp(target_width, 320, 1920, 1280))
    th = int(_clamp(target_height, 320, 1920, 720))
    shift = max(1, int(tw * 0.003 * strength))

    _make_scanline_overlay(scanline_path, tw, th)

    cmd = ["ffmpeg", "-y"]
    cmd += (["-loop", "1", "-i", input_path] if is_img else ["-i", input_path])
    cmd += ["-loop", "1", "-i", scanline_path, "-t", str(dur)]

    filter_complex = (
        f"[0:v]scale={tw}:{th},"
        f"rgbashift=rh=-{shift}:bh={shift},"
        f"noise=alls={noise_amt}:allf=t[base];"
        f"[base][1:v]overlay=0:0[vout]"
    )
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]", "-map", "0:a?"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
    cmd += (["-an"] if is_img else ["-c:a", "aac"])
    cmd += [output_path]
    return cmd
