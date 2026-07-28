import sys
import json
import traceback
from proglog import ProgressBarLogger

class RenderLogger(ProgressBarLogger):
    def bars_callback(self, bar, attr, value, old_value):
        if bar == 't':
            total = self.bars[bar]['total']
            if total > 0:
                prog = int((value / total) * 85) + 10
                print(f"PROGRESS:{prog}", file=sys.stderr)
                sys.stderr.flush()

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
    logger = RenderLogger()
    params['logger'] = logger
    
    try:
        if tool_type == "ken-burns":
            from app.effects.ken_burns import apply_ken_burns
            apply_ken_burns(input_path, output_path, **params)
        elif tool_type == "vhs-tape":
            from app.effects.vhs_tape import apply_vhs_tape
            apply_vhs_tape(input_path, output_path, **params)
        else:
            raise ValueError(f"Bilinmeyen tool_type: {tool_type}")
        print("OK")
    except MemoryError:
        print("Bellek limiti aşıldı (OOM)", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        traceback.print_exc()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
