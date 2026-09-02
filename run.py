import os
import sys
import traceback

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

if __name__ == "__main__":
    try:
        raw_port = os.environ.get("PORT", "8000")
        try:
            port = int(raw_port)
        except ValueError:
            port = 8000

        print("==================================================", flush=True)
        print(f"Starting Deadlock Voice Defense on http://localhost:{port}", flush=True)
        print("==================================================", flush=True)

        from backend.main import app
        import uvicorn

        uvicorn.run(
            app,
            host="0.0.0.0",
            port=port,
            log_level="info",
            access_log=True,
            proxy_headers=True,
            forwarded_allow_ips="*"
        )
    except Exception as exc:
        print(f"[FATAL] Server startup failed: {exc}", file=sys.stderr, flush=True)
        traceback.print_exc()
        sys.exit(1)
