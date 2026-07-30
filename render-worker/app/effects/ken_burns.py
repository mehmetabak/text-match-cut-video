import os
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip, ImageClip

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def apply_ken_burns(input_path: str, output_path: str,
                     duration: float = None, zoom_rate: float = 0.04,
                     format_preset: str = "16:9", hd_output: bool = False,
                     zoom_direction: str = "in", pan_style: str = "center", **kwargs):
                     
    is_img = _is_image(input_path)
    
    # Format and HD resolution determination
    if format_preset == "9:16":
        target_w, target_h = (1080, 1920) if hd_output else (720, 1280)
    elif format_preset == "1:1":
        target_w, target_h = (1080, 1080) if hd_output else (720, 720)
    else: # 16:9 default
        target_w, target_h = (1920, 1080) if hd_output else (1280, 720)
        
    # Cap source resolution to avoid massive RAM spikes on 4K/8K input
    max_src_height = 1080 if hd_output else 720
    
    if is_img:
        dur = duration if duration is not None else 8.0
        clip = ImageClip(input_path).set_duration(dur)
        if clip.h > max_src_height:
            clip = clip.resize(height=max_src_height)
    else:
        # Remove target_resolution to prevent accidental FFMPEG upscaling which causes OOM/timeouts
        clip = VideoFileClip(input_path)
        
        # Only downscale if the video is excessively large (4K etc)
        if clip.h > max_src_height:
            clip = clip.resize(height=max_src_height)
            
        if duration is not None and clip.duration is not None:
            clip = clip.subclip(0, min(duration, clip.duration))
        dur = clip.duration

    orig_w, orig_h = clip.size
    
    # Safely calculate actual zoom parameters considering aspect ratios
    # We want to make sure the crop fits inside the orig_w, orig_h while matching target aspect
    target_aspect = target_w / target_h
    orig_aspect = orig_w / orig_h
    
    if orig_aspect > target_aspect:
        # Original is wider, fit height
        base_crop_h = orig_h
        base_crop_w = int(base_crop_h * target_aspect)
    else:
        # Original is taller, fit width
        base_crop_w = orig_w
        base_crop_h = int(base_crop_w / target_aspect)
        
    # The zoom function will use base_crop for scaling math to perfectly preserve aspect ratio
    
    def _make_zoom_frame_func_fixed(base_w, base_h, target_w, target_h, zoom_rate, zoom_direction, pan_style, orig_w, orig_h):
        def frame_func(get_frame, t):
            frame = get_frame(t)
            
            # Calculate scale
            if zoom_direction == "out":
                scale = (1.0 + zoom_rate * 8.0) - zoom_rate * t
                scale = max(1.0, scale)
            else:
                scale = 1.0 + zoom_rate * t

            crop_w = max(2, int(base_w / scale))
            crop_h = max(2, int(base_h / scale))
            
            # Center of the crop within the ORIGINAL video bounds
            # We want to pan across the available original bounds
            
            # Start by centering the base crop in the original
            center_x = orig_w / 2.0
            center_y = orig_h / 2.0
            
            # Max pan is based on the difference between the original size and our CURRENT crop size
            max_pan_x = max(0, (orig_w - crop_w) / 2.0)
            max_pan_y = max(0, (orig_h - crop_h) / 2.0)
            
            progress = min(1.0, t / 8.0)
            
            if pan_style == "left_to_right":
                center_x = (crop_w / 2.0) + (progress * 2.0 * max_pan_x)
            elif pan_style == "right_to_left":
                center_x = (orig_w - crop_w / 2.0) - (progress * 2.0 * max_pan_x)
            elif pan_style == "top_to_bottom":
                center_y = (crop_h / 2.0) + (progress * 2.0 * max_pan_y)
            elif pan_style == "bottom_to_top":
                center_y = (orig_h - crop_h / 2.0) - (progress * 2.0 * max_pan_y)
                
            center_x = max(crop_w / 2.0, min(orig_w - crop_w / 2.0, center_x))
            center_y = max(crop_h / 2.0, min(orig_h - crop_h / 2.0, center_y))
            
            x1 = int(center_x - crop_w / 2.0)
            y1 = int(center_y - crop_h / 2.0)
            
            cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
            pil_img = Image.fromarray(cropped)
            return np.array(pil_img.resize((target_w, target_h), Image.Resampling.BILINEAR))
        return frame_func
        
    frame_func = _make_zoom_frame_func_fixed(base_crop_w, base_crop_h, target_w, target_h, zoom_rate, zoom_direction, pan_style, orig_w, orig_h)

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
