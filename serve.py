"""Same-origin static server + API reverse-proxy for one built frontend.
Serves the CRA build with SPA fallback and proxies /api/* to the backend, so
each app is fully self-contained behind a single (tunnel) origin — no CORS."""
import os
import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BUILD = os.environ["BUILD_DIR"]
PORT = int(os.environ.get("PORT", "8080"))
BACKEND = os.environ.get("BACKEND", "http://127.0.0.1:3000")

app = FastAPI()
client = httpx.AsyncClient(base_url=BACKEND, timeout=60)

HOP = {"host", "content-length", "content-encoding", "transfer-encoding", "connection"}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    r = await client.request(request.method, "/api/" + path,
                             params=request.query_params, content=body, headers=headers)
    out = {k: v for k, v in r.headers.items() if k.lower() not in HOP}
    return Response(content=r.content, status_code=r.status_code, headers=out)


app.mount("/static", StaticFiles(directory=os.path.join(BUILD, "static")), name="static")


@app.get("/{full:path}")
async def spa(full: str):
    fp = os.path.join(BUILD, full)
    if full and os.path.isfile(fp):
        return FileResponse(fp)
    return FileResponse(os.path.join(BUILD, "index.html"))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
