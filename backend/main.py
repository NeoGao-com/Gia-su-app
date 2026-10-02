import sys
import os
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI(title="Error Fallback")
    err_msg = str(e)
    err_tb = traceback.format_exc()
    
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    async def fallback_error(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialize on Vercel",
                "details": err_msg,
                "traceback": err_tb.splitlines()
            }
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
