import os
import sys
import traceback

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

if __name__ == "__main__":
    try:
        raw_port = os.environ.get("PORT", "10000")
        try:
            port = int(raw_port)
        except ValueError:
            port = 10000

        print("==================================================", flush=True)
        print(f"Starting Deadlock Voice Defense Core on 0.0.0.0:{port}", flush=True)
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
