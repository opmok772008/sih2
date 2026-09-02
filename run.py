import os
import sys
import uvicorn

if __name__ == "__main__":
    # Render assigns the active listening port via the PORT environment variable
    raw_port = os.environ.get("PORT", "10000")
    try:
        port = int(raw_port)
    except ValueError:
        port = 10000

    print("==================================================")
    print("Starting Deadlock Cyber-Defense Web Service")
    print(f"Host: 0.0.0.0 | Port: {port}")
    print("==================================================")
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
        workers=1,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
