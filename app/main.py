"""UmaWorld — servidor FastAPI (API REST + WebSocket + frontend estático).

Rodar localmente:
    uvicorn app.main:app --reload
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import STATIC_DIR
from .database import engine
from .game.rewards import GameError
from .migrate import prepare_database
from .realtime import hub
from .routers import ALL as ROUTERS

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("umaworld")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Mostra qual banco está em uso (a senha aparece como ***).
    url = engine.url
    log.info("Banco de dados: %s", f"SQLite ({url.database})" if url.get_backend_name() == "sqlite"
             else url.render_as_string(hide_password=True))
    prepare_database()  # migra, cria as tabelas, liga o RLS (PostgreSQL) e preenche o catálogo
    await hub.start()
    yield
    await hub.stop()


app = FastAPI(title="UmaWorld", version="1.0.0", lifespan=lifespan)


@app.exception_handler(GameError)
async def game_error_handler(_request: Request, exc: GameError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


FIELD_MESSAGES = {
    "nickname": "O apelido deve ter de 3 a 16 caracteres: letras, números ou _.",
    "password": "A senha deve ter de 6 a 64 caracteres.",
    "count": "Dá para fazer de 1 a 10 pulls por vez.",
}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    for error in exc.errors():
        for part in error.get("loc", ()):
            if part in FIELD_MESSAGES:
                return JSONResponse(status_code=422, content={"detail": FIELD_MESSAGES[part]})
    return JSONResponse(status_code=422, content={"detail": "Dados inválidos na requisição."})


@app.get("/api/health")
def health():
    return {"ok": True}


for router in ROUTERS:
    app.include_router(router)


class GameFiles(StaticFiles):
    """Arquivos do frontend.

    Sem etapa de build, um arquivo mantém o mesmo nome em todas as versões. Sem Cache-Control,
    o navegador reaproveitaria a cópia antiga por horas depois de uma atualização (o HTML novo
    rodando com o JavaScript velho). "no-cache" faz ele conferir antes com o servidor, que
    responde 304 quando nada mudou. As imagens quase nunca mudam e podem ficar um dia.
    """

    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        image = str(full_path).endswith((".webp", ".png", ".jpg"))
        response.headers["Cache-Control"] = "public, max-age=86400" if image else "no-cache"
        return response


# O frontend é servido pelo próprio FastAPI: um único deploy, sem CORS.
app.mount("/", GameFiles(directory=STATIC_DIR, html=True), name="static")
