import os
import tempfile
import subprocess
from PIL import Image
from moviepy.editor import VideoFileClip
import imageio_ffmpeg

def safe_downscale(input_path: str, is_img: bool, max_h: int) -> str:
    """
    Downscales an image or video using native FFMPEG/Pillow.
    Avoids MoviePy's clip.resize() which is broken on Pillow 10+ (ANTIALIAS error).
    Returns the path to the original or downscaled file.
    """
    if is_img:
        img = Image.open(input_path).convert('RGB')
        if img.height > max_h:
            w = int(img.width * (max_h / img.height))
            img = img.resize((w, max_h), Image.Resampling.LANCZOS)
            temp_path = os.path.join(tempfile.gettempdir(), f"downscaled_{os.path.basename(input_path)}.jpg")
            img.save(temp_path, quality=95)
            return temp_path
        return input_path
    else:
        clip = VideoFileClip(input_path)
        h = clip.h
        clip.close()
        
        if h > max_h:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            temp_path = os.path.join(tempfile.gettempdir(), f"downscaled_{os.path.basename(input_path)}")
            # For mp4 extension guarantee
            if not temp_path.endswith('.mp4'):
                temp_path += '.mp4'
                
            subprocess.run([
                ffmpeg_exe, "-y", "-i", input_path,
                "-vf", f"scale=-2:{max_h}",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "copy",
                temp_path
            ], check=True, capture_output=True)
            return temp_path
        return input_path
