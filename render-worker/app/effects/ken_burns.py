import os

def _is_image(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp")

def _clamp(value, lo, hi, default):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))

def build_ken_burns_cmd(input_path: str, output_path: str,
                         duration=None, zoom_rate=0.04, zoom_direction="in",
                         pan_style="center", target_width=1280, target_height=720):
    is_img = _is_image(input_path)
    dur = _clamp(duration, 1, 210, 210.0)
    zoom_rate = _clamp(zoom_rate, 0.0, 0.15, 0.04)
    tw = int(_clamp(target_width, 320, 1920, 1280))
    th = int(_clamp(target_height, 320, 1920, 720))
    fps = 25
    total_frames = int(dur * fps)

    prescale = "scale=8000:-1" if is_img else f"scale='if(gt(iw,{tw}*2),{tw}*2,iw)':-2"

    if zoom_direction == "out":
        zoom_expr = f"max(1.5-{zoom_rate}*on/{fps},1)"
    else:
        zoom_expr = f"min(zoom+{zoom_rate}/{fps},1.5)"

    pan_x = {
        "center": "iw/2-(iw/zoom/2)",
        "left-to-right": f"(iw-iw/zoom)*on/{max(total_frames,1)}",
        "right-to-left": f"(iw-iw/zoom)*(1-on/{max(total_frames,1)})",
    }.get(pan_style, "iw/2-(iw/zoom/2)")

    d_value = total_frames if is_img else 1
    zoompan = f"zoompan=z='{zoom_expr}':x='{pan_x}':y='ih/2-(ih/zoom/2)':d={d_value}:s={tw}x{th}:fps={fps}"
    vf = f"{prescale},{zoompan}"

    cmd = ["ffmpeg", "-y"]
    cmd += (["-loop", "1", "-i", input_path] if is_img else ["-i", input_path])
    cmd += ["-t", str(dur), "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"]
    cmd += (["-an"] if is_img else ["-c:a", "aac"])
    cmd += [output_path]
    return cmd
