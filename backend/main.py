import sys
import os
import traceback
from fastapi import FastAPI

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

app = FastAPI(title="TutorQuiz Diagnostic")

@app.get("/api/health")
@app.get("/health")
@app.get("/api/ping")
@app.get("/ping")
@app.get("/api")
@app.get("/")
async def diagnostic_check():
    report = {}
    modules = [
        "app.services.ai_service",
        "app.routers.rendering",
        "app.routers.auth",
        "app.routers.questions",
        "app.routers.exam",
        "app.routers.export",
        "app.routers.student",
        "app.routers.classroom",
        "app.routers.analytics",
        "app.routers.upload",
        "app.routers.uploads_protected",
        "app.routers.tasks",
        "app.routers.ai",
        "app.routers.notifications",
        "app.routers.ai_config",
        "app.main"
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
