# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    PATH="/root/.local/bin:$PATH"

RUN apt-get update && apt-get install --no-install-recommends -y \
    curl build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR /app

COPY pyproject.toml poetry.lock ./

RUN poetry install --no-root --without dev

COPY . .

# Expose port
EXPOSE 8000

CMD ["sh", "-c", "poetry run uvicorn instacrud.app:app \
     --host 0.0.0.0 \
     --port ${PORT:-8000} \
     --workers ${UVICORN_WORKERS:-4} \
     --loop uvloop \
     --http httptools"]