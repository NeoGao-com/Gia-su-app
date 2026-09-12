import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = logging.getLogger("app.middleware.request")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"

        # Extract user if available in request state (e.g. from auth middleware/dependency)
        # We can also capture path, method
        path = request.url.path
        method = request.method

        response = None
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            status_code = response.status_code

            logger.info(
                f"IP: {client_ip} | Method: {method} | Path: {path} | Status: {status_code} | Duration: {process_time:.2f}ms"
            )
            return response
        except Exception as exc:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"IP: {client_ip} | Method: {method} | Path: {path} | Error: {str(exc)} | Duration: {process_time:.2f}ms",
                exc_info=True
            )
            raise
