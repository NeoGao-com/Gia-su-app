import sys
import os
import traceback

# Ensure backend directory is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.main import app as real_app
    app = real_app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Error Fallback")
    _err_msg = str(e)
    _err_tb = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    @app.api_route("/", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def fallback_error(path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialize on Vercel",
                "details": _err_msg,
                "traceback": _err_tb.splitlines()
            }
        )

# Explicit top-level handler definitions for Vercel/AWS Lambda analyzer
handler = app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
