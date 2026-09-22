# FLUENTT: Adaptive Language Learning System

FLUENTT is an adaptive language learning system with enhanced spaced repetition and NLP-driven pronunciation modeling, designed as a research-oriented Computer Science thesis platform.

## Architecture

FLUENTT uses a client-server architecture:
- **Backend**: Python 3.13, FastAPI application gateway, PostgreSQL 17 server database, SQLAlchemy 2.x ORM, Alembic migrations.
- **Mobile**: React Native + Expo (Plan B).

## Getting Started (Backend)

### Prerequisites

- Python 3.13
- `uv` package manager
- PostgreSQL 17 (or Docker Compose)

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Install dependencies using `uv`:
   ```bash
   cd backend
   uv sync
   ```

### Running the Database

- Using Docker:
  ```bash
  docker compose up -d db
  ```
- Or local PostgreSQL 17 on port 5432 with credentials in `.env`.

### Database Migrations

Apply Alembic migrations:
```bash
cd backend
uv run alembic upgrade head
```

### Seeding Content

Import sample English and Tagalog datasets:
```bash
cd backend
uv run python scripts/import_content.py ../scripts/seed_content/sample-en-v0.1.json
uv run python scripts/import_content.py ../scripts/seed_content/sample-fil-v0.1.json
```

### Participant Provisioning & Password Reset

Provision a learner participant:
```bash
cd backend
uv run python scripts/create_participant.py --email learner1@example.test --participant-code P001
```

Reset a participant password:
```bash
cd backend
uv run python scripts/reset_participant_password.py --participant-code P001
```

### Testing & Linting

Run automated tests and linting:
```bash
cd backend
uv run pytest -v
uv run ruff check app tests scripts
```
