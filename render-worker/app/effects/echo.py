import os
import numpy as np
from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def apply_echo(input_path: str, output_path: str,
               echo_count: int = 5, echo_decay: float = 0.7,
               duration: float = None, format_preset: str = "16:9",
               hd_output: bool = False, **kwargs):
    is_img = _is_image(input_path)
    from .utils import safe_downscale

    max_src_height = 1080 if hd_output else 720
    input_path = safe_downscale(input_path, is_img, max_src_height)

    echo_count = max(2, min(10, int(echo_count)))
    echo_decay = max(0.2, min(0.95, float(echo_decay)))

    if is_img:
        dur = duration if duration is not None else 6.0
        base_clip = ImageClip(input_path).set_duration(dur)
        orig_w, orig_h = base_clip.size
        
        clips = [base_clip]
        delay_step = 0.35
        for i in range(1, echo_count):
            opacity = float((echo_decay ** i) * 0.6)
            echo_layer = (base_clip
                          .set_opacity(opacity))
            clips.append(echo_layer)
            
        processed = CompositeVideoClip(clips, size=(orig_w, orig_h)).set_duration(dur)
    else:
        clip = VideoFileClip(input_path)
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration

        # Create delayed video echo layers
        clips = [clip]
        delay_step = 0.08  # 80ms delay between echo ghost trails
        for i in range(1, echo_count):
            delay_sec = i * delay_step
            if delay_sec < dur:
                opacity = float((echo_decay ** i) * 0.75)
                delayed = (clip
                           .subclip(0, max(0.05, dur - delay_sec))
                           .set_start(delay_sec)
                           .set_opacity(opacity))
                clips.append(delayed)

        processed = CompositeVideoClip(clips, size=clip.size).set_duration(dur)
        if clip.audio is not None:
            processed = processed.set_audio(clip.audio)

    if is_img and getattr(processed, 'fps', None) is None:
        processed = processed.set_fps(24)

    processed.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,
        preset="ultrafast",
        threads=2,
        ffmpeg_params=["-crf", "23" if hd_output else "28", "-pix_fmt", "yuv420p"]
    )

    if not is_img:
        clip.close()
    processed.close()
