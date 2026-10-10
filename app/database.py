import time

from sqlalchemy import create_engine, event
from sqlalchemy.exc import DisconnectionError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL

IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Uma conexão parada por mais tempo que isso é testada antes de voltar a ser usada.
IDLE_PING_SECONDS = 60

if IS_SQLITE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
else:
    engine = create_engine(
        DATABASE_URL,
        # Até 10 conexões: o pooler do Supabase (modo sessão) limita os clientes de cada projeto.
        pool_size=5,
        max_overflow=5,
        # Sem prepared statements no servidor: funciona também no pooler em modo transação (porta 6543).
        connect_args={"prepare_threshold": None},
    )

if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

else:
    # Conexões que caíram (pausa do banco, reinício do pooler) são descartadas antes do uso.
    # O pool_pre_ping faria esse teste em toda requisição, e cada teste é uma ida ao banco a mais
    # (~120 ms com o servidor longe do banco). Aqui só testa a conexão que ficou parada.

    @event.listens_for(engine, "connect")
    def _mark_new(_dbapi_conn, record):
        record.info["used_at"] = time.monotonic()

    @event.listens_for(engine, "checkout")
    def _ping_if_idle(dbapi_conn, record, _proxy):
        if time.monotonic() - record.info.get("used_at", 0) < IDLE_PING_SECONDS:
            return
        try:
            engine.dialect.do_ping(dbapi_conn)
        except Exception as exc:
            raise DisconnectionError("conexão parada caiu") from exc  # o pool troca por uma nova

    @event.listens_for(engine, "checkin")
    def _mark_used(_dbapi_conn, record):
        record.info["used_at"] = time.monotonic()


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

_CACHE = "cache"


def session_cache(db: Session, key, load):
    """Lê algo do banco uma vez por requisição e guarda na sessão.

    Serve para linhas que uma ação consulta várias vezes (inventário, coleção, progresso
    das missões): em vez de uma ida ao banco por item, uma consulta traz todas. Quem altera
    essas linhas na mesma requisição altera os objetos guardados, então o que fica aqui
    acompanha o que vai ser gravado. Um rollback descarta tudo.
    """
    cache = db.info.setdefault(_CACHE, {})
    if key not in cache:
        cache[key] = load()
    return cache[key]


def cached(db: Session, key):
    """O que `session_cache` já guardou para `key`, ou None (sem consultar o banco)."""
    return db.info.get(_CACHE, {}).get(key)


def forget(db: Session, key) -> None:
    """Descarta o que `session_cache` guardou para `key`: a próxima leitura consulta o banco.
    Para quando a ação muda quais linhas a consulta traria (e não só os valores delas)."""
    db.info.get(_CACHE, {}).pop(key, None)


@event.listens_for(Session, "after_rollback")
def _drop_cache(session: Session) -> None:
    session.info.pop(_CACHE, None)


def get_db():
    """Uma sessão por requisição. Os endpoints fazem commit explicitamente;
    qualquer coisa não commitada é descartada ao fechar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.info.pop("feed_pending", None)
        db.close()
