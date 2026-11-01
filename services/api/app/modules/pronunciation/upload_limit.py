"""Bound the entire pronunciation multipart body before framework spooling/field parsing."""

from fastapi import HTTPException
from fastapi.routing import APIRoute

MAX_BODY = 10 * 1024 * 1024 + 65536


class AudioUploadRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handle(request):
            if request.method == "POST" and request.url.path == "/api/v1/me/pronunciation/attempts":
                declared = request.headers.get("content-length")
                if declared:
                    try:
                        length = int(declared)
                    except ValueError:
                        raise HTTPException(400) from None
                    if length < 0 or length > MAX_BODY:
                        raise HTTPException(413)
                size = 0
                chunks = []
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_BODY:
                        raise HTTPException(413)
                    chunks.append(chunk)
                # Starlette Request.stream/body honor the request-local body cache.
                request._body = b"".join(chunks)
            return await original(request)

        return handle
