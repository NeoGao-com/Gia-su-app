import sys
import os
import traceback
from fastapi import FastAPI

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

app = FastAPI()

@app.get("/api/ping")
@app.get("/ping")
@app.get("/health")
@app.get("/api/health")
@app.get("/api")
@app.get("/")
async def diagnostic_check():
    report = {}
    modules = [
        "fastapi", "sqlalchemy", "asyncpg", "pydantic", "jose",
        "bcrypt", "openai", "docx", "latex2mathml", "app.database",
        "app.models.user", "app.routers.auth", "app.main"
    ]
    for m in modules:
        try:
            __import__(m)
            report[m] = "OK"
        except Exception as e:
            report[m] = f"ERROR: {str(e)}\n{traceback.format_exc()}"
    return {"status": "diagnostic", "report": report}

handler = app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
