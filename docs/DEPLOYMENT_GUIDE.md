# FLUENTT — DEPLOYMENT AND CONFIGURATION GUIDE

**Version**: 1.0 (Section 39 Defense-Ready)  
**Target Environments**: Local Development (Windows/macOS/Linux), Staging Server, Production Docker Environment

---

## 1. System Architecture & Requirements

FLUENTT is organized as three distinct services backed by a shared PostgreSQL database:
1. **API Backend**: Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Alembic
2. **Administrator Portal**: Node.js 20+ / Next.js 16 (App Router) / React 19
3. **Mobile Client**: Expo SDK 58 / React Native 0.88 / React Native Web
4. **Relational Database**: PostgreSQL 15, 16, or 17

### Minimum System Specifications
- **CPU**: 2 vCPUs (4 vCPUs recommended for concurrent audio processing)
- **RAM**: 4 GB (8 GB recommended for simultaneous Next.js build and ML inference)
- **Disk Storage**: 20 GB SSD (for database, audio buffers, and logs)
- **Operating System**: Linux (Ubuntu 22.04 LTS recommended for production) or Windows 10/11 (with PowerShell 7+)

---

## 2. Environment Configuration & Templates

Create environment configuration files using the following safe templates. Never commit `.env` files containing production secrets to source control.

### 2.1 Backend API (`services/api/.env`)

```ini
# Environment Mode: development | staging | production
ENVIRONMENT=production
DEBUG=false

# Networking & Host
HOST=0.0.0.0
PORT=8000
SERVER_NAME="FLUENTT API"

# Database Connection (PostgreSQL 15-17)
DATABASE_URL=postgresql+psycopg://fluentt_user:StrongPasswordHere@127.0.0.1:5432/fluentt_db

# Security & Sessions
SECRET_KEY=generate_with_openssl_rand_hex_32
SESSION_IDLE_TIMEOUT_MINUTES=1440
SESSION_ABSOLUTE_TIMEOUT_HOURS=168

# Allowed CORS Origins (comma-separated, no trailing slash, no wildcards in prod)
ALLOWED_CORS_ORIGINS=https://admin.fluentt.edu,https://app.fluentt.edu,http://localhost:3000,http://localhost:8081

# Trusted Reverse Proxy (if behind Nginx/Caddy/Cloudflare)
TRUSTED_PROXY_HEADERS=true

# AI & Speech Service Providers (Leave empty to use local mock/heuristic adapters)
ASR_PROVIDER=heuristic # Options: heuristic | whisper | google
ASR_API_KEY=
LLM_PROVIDER=rule_based # Options: rule_based | openai | anthropic
LLM_API_KEY=
```

### 2.2 Next.js Admin Portal (`apps/admin/.env.local`)

```ini
# Node Environment
NODE_ENV=production

# Public API URL (accessible by browser)
NEXT_PUBLIC_API_URL=https://api.fluentt.edu

# Internal API URL (accessible by Next.js SSR backend)
INTERNAL_API_URL=http://127.0.0.1:8000

# Cookie & Session Encryption Key
ADMIN_SESSION_SECRET=another_random_hex_32_string
```

### 2.3 Expo Mobile Application (`apps/mobile/.env`)

```ini
# Public API Endpoint for mobile devices
EXPO_PUBLIC_API_BASE_URL=https://api.fluentt.edu
EXPO_PUBLIC_ENVIRONMENT=production
```

---

## 3. Database Initialization & Migration Procedure

The database schema is strictly managed by Alembic. The current schema head is `0013_learning_focus` with 63 tables.

### 3.1 Initial Setup on a Fresh PostgreSQL Instance

```bash
# 1. Connect to PostgreSQL as superuser
psql -U postgres -h 127.0.0.1

# 2. Create database and user
CREATE USER fluentt_user WITH PASSWORD 'StrongPasswordHere';
CREATE DATABASE fluentt_db OWNER fluentt_user;
GRANT ALL PRIVILEGES ON DATABASE fluentt_db TO fluentt_user;
\q
```

### 3.2 Running Migrations

```powershell
# In services/api with virtual environment activated:
alembic upgrade head
```

*Verification*: Verify that `alembic current` outputs `0013_learning_focus (head)`.

### 3.3 Database Backups & Rollback Strategy

1. **Daily Logical Backup**:
   ```bash
   pg_dump -U fluentt_user -h 127.0.0.1 -Fc fluentt_db > /backups/fluentt_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Restoring from Backup**:
   ```bash
   pg_restore -U fluentt_user -h 127.0.0.1 -d fluentt_db --clean /backups/fluentt_20261020.dump
   ```
3. **Migration Rollbacks**:
   - Downgrading frozen migrations (`0001` through `0013`) is prohibited in production because it drops participant records and assessment histories.
   - For emergency rollbacks of recent feature revisions, use `alembic downgrade -1` only in staging with verified backups.

---

## 4. Production Deployment & Process Management

### 4.1 FastAPI Backend (Systemd or Gunicorn/Uvicorn)

Run Uvicorn workers behind a process supervisor:

```bash
# Example systemd unit: /etc/systemd/system/fluentt-api.service
[Unit]
Description=FLUENTT FastAPI Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=fluentt
WorkingDirectory=/var/www/fluentt/services/api
ExecStart=/var/www/fluentt/services/api/.venv/bin/gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --access-logfile /var/log/fluentt/api_access.log \
    --error-logfile /var/log/fluentt/api_error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4.2 Next.js Admin Portal (Node/PM2)

```bash
# Build standalone bundle
cd apps/admin
npm ci
npm run build

# Start with PM2
pm2 start npm --name "fluentt-admin" -- start -- -p 3000
```

### 4.3 Expo Mobile Client Deployment

1. **Web Version**:
   ```bash
   cd apps/mobile
   npx expo export -p web
   # Generated files in dist/ can be served as static files via Nginx or Cloudflare Pages
   ```
2. **Android APK / AAB**:
   ```bash
   cd apps/mobile
   # Requires EAS CLI or local Android SDK:
   npx eas build -p android --profile production
   ```

---

## 5. Reverse Proxy & Security Configuration (Nginx)

Place an Nginx reverse proxy in front of the services to handle SSL/TLS termination, HTTP/2, security headers, and rate limiting.

```nginx
# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# Upstream definitions
upstream fastapi_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream nextjs_admin {
    server 127.0.0.1:3000;
    keepalive 32;
}

# 1. API Backend (api.fluentt.edu)
server {
    listen 443 ssl http2;
    server_name api.fluentt.edu;

    ssl_certificate /etc/letsencrypt/live/api.fluentt.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fluentt.edu/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none';" always;

    # Request size limit (15MB for audio uploads)
    client_max_body_size 15M;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://fastapi_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/users {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://fastapi_backend;
    }
}

# 2. Administrator Portal (admin.fluentt.edu)
server {
    listen 443 ssl http2;
    server_name admin.fluentt.edu;

    ssl_certificate /etc/letsencrypt/live/admin.fluentt.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.fluentt.edu/privkey.pem;

    location / {
        proxy_pass http://nextjs_admin;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Troubleshooting Common Deployment Issues

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| `alembic upgrade head` fails with constraint error | Database was created with old naming convention | Run with `-x repair_initial_names=true` adapter on empty database, or verify database head. |
| CORS origin error on mobile client | Missing `ALLOWED_CORS_ORIGINS` in `services/api/.env` | Add the exact mobile origin (`http://localhost:8081` or your production domain). Avoid trailing slashes. |
| Next.js server fails to start with EADDRINUSE | Port 3000 or 3015 is locked by a previous process | Find and terminate lingering process: `Get-Process node \| Stop-Process` (Windows) or `kill -9 $(lsof -t -i:3000)` (Linux). |
| Audio recording upload rejected with 413 | Audio file exceeds `client_max_body_size` | Update Nginx `client_max_body_size 15M;` and check backend audio validator settings. |
| ESLint memory exhaustion in mobile build | ESLint scanning generated `dist/` web assets | Ensure `eslint.config.js` defines `{ ignores: ['dist/**', '.expo/**', 'node_modules/**'] }` as a standalone object. |
