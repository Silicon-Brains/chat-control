"""Production entrypoint: ``uvicorn app.asgi:app`` (settings are read from the environment)."""

from app.main import create_app

app = create_app()
