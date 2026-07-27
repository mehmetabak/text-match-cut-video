import sys
import json
import resource
import traceback

def set_memory_limit(mb=380):
    """
    Alt-sürecin kendi adres alanını sınırla. Aşılırsa Python MemoryError fırlatır
    (yakalanabilir) — kernel'in SIGKILL'ine kıyasla çok daha kontrollü bir hata.
    """
    try:
        limit_bytes = mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
    except (ValueError, OSError):
        pass  # RLIMIT_AS Windows'ta veya bazi ortamlarda calismayabilir

def main():
    set_memory_limit(380)
    if len(sys.argv) < 6:
        print("Eksik argumanlar", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[1]
    tool_type = sys.argv[2]
    input_path = sys.argv[3]
    output_path = sys.argv[4]
    params_json = sys.argv[5]
    
    params = json.loads(params_json)
    
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
