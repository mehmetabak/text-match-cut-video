import os
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def _make_zoom_frame_func(orig_w, orig_h, target_w, target_h, zoom_rate, dur, zoom_direction, pan_style, orig_pil_img):
    def frame_func(get_frame, t):
        t_ratio = t / dur if dur > 0 else 0
        
        if zoom_direction == 'out':
            max_scale = 1 + zoom_rate * dur
            scale = max_scale - zoom_rate * t
        else:
            scale = 1 + zoom_rate * t
            
        crop_w = max(2, min(int(target_w / scale), orig_w))
        crop_h = max(2, min(int(target_h / scale), orig_h))
        
        center_x = (orig_w - crop_w) // 2
        center_y = (orig_h - crop_h) // 2
        
        if pan_style == 'left_to_right':
            x1 = int((orig_w - crop_w) * t_ratio)
            y1 = center_y
        elif pan_style == 'right_to_left':
            x1 = int((orig_w - crop_w) * (1 - t_ratio))
            y1 = center_y
        elif pan_style == 'top_to_bottom':
            x1 = center_x
            y1 = int((orig_h - crop_h) * t_ratio)
        elif pan_style == 'bottom_to_top':
            x1 = center_x
            y1 = int((orig_h - crop_h) * (1 - t_ratio))
        else: # center
            x1 = center_x
            y1 = center_y
            
        # Bounds check
        x1 = max(0, min(x1, orig_w - crop_w))
        y1 = max(0, min(y1, orig_h - crop_h))
        
        # O(1) True Speed Optimization for Images: Direct PIL Cropping
        if orig_pil_img:
            cropped_pil = orig_pil_img.crop((x1, y1, x1 + crop_w, y1 + crop_h))
            return np.array(cropped_pil.resize((target_w, target_h), Image.Resampling.BILINEAR))
        else:
            frame = get_frame(t)
            cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
            pil_img = Image.fromarray(cropped)
            return np.array(pil_img.resize((target_w, target_h), Image.Resampling.BILINEAR))
            
    return frame_func

def apply_ken_burns(input_path: str, output_path: str,
                     duration: float = None, zoom_rate: float = 0.04,
                     quality: str = "720p", aspect_ratio: str = "16:9",
                     zoom_direction: str = "in", pan_style: str = "center", logger=None, **kwargs):
    is_img = _is_image(input_path)
    
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

    orig_pil_img = None
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
        orig_pil_img = Image.open(input_path).convert('RGB')
        orig_w, orig_h = orig_pil_img.size
    else:
        clip = VideoFileClip(input_path)
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration
        orig_w, orig_h = clip.size
        
        # True speed optimization for video: downscale read if target is 720p
        if quality == "720p" and orig_h > 720:
            new_h = 720
            new_w = int(orig_w * (720 / orig_h))
            new_w = new_w - (new_w % 2) # ensure even
            clip.close()
            # FFMPEG Native Downscale
            clip = VideoFileClip(input_path, target_resolution=(new_h, new_w))
            if duration is not None and clip.duration is not None:
                clip = clip.subclip(0, min(duration, clip.duration))
            orig_w, orig_h = clip.size

    frame_func = _make_zoom_frame_func(orig_w, orig_h, target_w, target_h, zoom_rate, dur, zoom_direction, pan_style, orig_pil_img)

    final = clip.fl(frame_func, apply_to=[])
    final = final.set_duration(dur).set_fps(24)

    final.write_videofile(
        output_path,
        codec="libx264",
        audio=not is_img,          
        preset="ultrafast",          
        threads=2,
        logger=logger,                 
        ffmpeg_params=["-crf", "23", "-movflags", "faststart"],
    )

    clip.close()
    final.close()
    if orig_pil_img:
        orig_pil_img.close()
