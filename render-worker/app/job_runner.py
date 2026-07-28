import os
import sys
import json
import traceback
import subprocess
import re

ALLOWED_TOOL_TYPES = {"ken-burns", "vhs-tape"}

def set_memory_limit(mb=380):
    try:
        import resource
        limit_bytes = mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
    except (ImportError, ValueError, OSError):
        pass

def main():
    
    if len(sys.argv) < 6:
        print("Eksik argumanlar", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[1]
    tool_type = sys.argv[2]
    input_path = sys.argv[3]
    output_path = sys.argv[4]
    params_json = sys.argv[5]
    
    params = json.loads(params_json)

    if tool_type not in ALLOWED_TOOL_TYPES:
        print(f"ERROR: Desteklenmeyen tool_type: {tool_type}", file=sys.stderr)
        sys.exit(1)

    try:
        if tool_type == "ken-burns":
            from app.effects.ken_burns import build_ken_burns_cmd
            cmd = build_ken_burns_cmd(input_path, output_path, **params)
        else:
            from app.effects.vhs_tape import build_vhs_tape_cmd
            import tempfile, uuid
            scanline_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}_scanline.png")
            cmd = build_vhs_tape_cmd(input_path, output_path, scanline_path, **params)

        # Run ffmpeg and read stderr to extract progress
        process = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, universal_newlines=True)
        
        duration_sec = 0.0
        time_re = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
        duration_re = re.compile(r"Duration: (\d+):(\d+):(\d+\.\d+)")
        
        for line in process.stderr:
            sys.stderr.write(line)
            sys.stderr.flush()
            
            if duration_sec == 0.0:
                dur_match = duration_re.search(line)
                if dur_match:
                    h, m, s = map(float, dur_match.groups())
                    duration_sec = h * 3600 + m * 60 + s
            
            time_match = time_re.search(line)
            if time_match and duration_sec > 0:
                h, m, s = map(float, time_match.groups())
                current_sec = h * 3600 + m * 60 + s
                progress = min(100, int((current_sec / duration_sec) * 100))
                print(f"PROGRESS:{progress}", flush=True)

        process.wait()
        
        if process.returncode != 0:
            sys.exit(1)
            
        print("OK")
        
    except MemoryError:
        print("Bellek limiti asildi", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        traceback.print_exc()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
