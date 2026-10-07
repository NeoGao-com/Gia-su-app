import sys
import os
import traceback

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Top-level handler definition for Vercel static analysis
app = FastAPI(title="TutorQuiz Backend")

try:
    from app.main import app as main_app
    app = main_app
    handler = app
except Exception as _e:
    handler = app
    _err_msg = str(_e)
    _err_tb = traceback.format_exc()
    
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    async def fallback_error(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialize on Vercel",
                "details": _err_msg,
                "traceback": _err_tb.splitlines()
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
