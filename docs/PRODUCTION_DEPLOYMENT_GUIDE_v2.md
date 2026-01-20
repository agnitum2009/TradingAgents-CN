# TACN v2.0 Production Deployment Guide

**Date**: 2025-01-20
**Version**: 2.0.0
**Branch**: v2.0-restructure

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Deployment Methods](#deployment-methods)
5. [Docker Deployment](#docker-deployment)
6. [Direct Deployment](#direct-deployment)
7. [Configuration](#configuration)
8. [Monitoring](#monitoring)
9. [Rollback](#rollback)
10. [Troubleshooting](#troubleshooting)

---

## Overview

TACN v2.0 introduces a hybrid architecture with:

- **Backend**: Python FastAPI (orchestration) + TypeScript Fastify (API layer)
- **Frontend**: Vue 3 with TypeScript
- **Database**: MongoDB 7.0
- **Cache**: Redis 7
- **Real-time**: WebSocket via `ws` package
- **Rust Modules**: WASM acceleration for core algorithms

### Key Changes from v1.x

| Area | v1.x | v2.0 |
|------|------|------|
| API Layer | Python FastAPI only | TypeScript Fastify + Python bridge |
| Authentication | Python-based | JWT with TypeScript validation |
| WebSocket | SSE + Redis PubSub | Native WebSocket with `ws` |
| Real-time Data | Polling-based | WebSocket push-based |
| Quote Streaming | Not available | Built-in quote subscription |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                   │
│                      Port 80/443 → SSL termination              │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│      Frontend (Vue 3)           │   │      Backend Services            │
│      Port 3000                  │   │      Port 8000                   │
│  - Static files                 │   │  - Python FastAPI (orchestration)│
│  - WebSocket client             │   │  - Python data services          │
│  - API calls → Backend          │   │  - Python worker jobs            │
└─────────────────────────────────┘   └─────────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┴───────────────────────┐
                    ▼                               ▼                       ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│   TypeScript API Server         │   │        MongoDB 7.0               │   │        Redis 7                   │
│   Port 3001                     │   │        Port 27017                │   │        Port 6379                 │
│  - Fastify server               │   │  - User data                    │   │  - Cache & sessions            │
│  - WebSocket server             │   │  - Analysis results             │   │  - Progress tracking           │
│  - Quote streaming              │   │  - Watchlists                   │   │  - Rate limiting               │
│  - Auth/Analysis/Queue/News     │   │  - Config                       │   │  - Pub/Sub (legacy)            │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Disk | 50 GB SSD | 100+ GB SSD |
| OS | Linux (Ubuntu 22.04+) | Ubuntu 22.04 LTS |

### Software Requirements

- Docker 24.0+ and Docker Compose v2
- Node.js 20+ LTS
- Python 3.10+
- MongoDB 7.0
- Redis 7

---

## Deployment Methods

### Method Comparison

| Method | Pros | Cons | Use Case |
|--------|------|------|----------|
| **Docker Compose** | Easy setup, isolated, reproducible | Requires Docker | Production standard |
| **Direct Deployment** | Full control, native performance | More complex setup | Custom environments |
| **Kubernetes** | Scalable, self-healing | Complex setup | Large-scale deployments |

---

## Docker Deployment

### 1. Build Images

```bash
# Build all images
docker-compose -f docker-compose.production.yml build

# Build specific image
docker build -f Dockerfile.backend -t tacn/backend:v2.0.0 .
docker build -f Dockerfile.frontend -t tacn/frontend:v2.0.0 .
```

### 2. Configure Environment

```bash
# Copy production env template
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

### Required Configuration

```bash
# Security (REQUIRED)
SECRET_KEY=your_secret_key_min_32_characters_here
JWT_SECRET_KEY=your_jwt_secret_min_32_characters_here
MONGODB_PASSWORD=your_secure_mongodb_password
REDIS_PASSWORD=your_secure_redis_password

# Database (REQUIRED)
MONGODB_HOST=mongodb
MONGODB_DATABASE=tacn_production
MONGODB_USERNAME=tacn_user

# CORS (update for your domain)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 3. Start Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Start with monitoring profile
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# Start with backup profile
docker-compose -f docker-compose.production.yml --profile backup up -d
```

### 4. Verify Deployment

```bash
# Check service health
curl http://localhost:8000/api/health
curl http://localhost:3001/health

# Check frontend
curl http://localhost:3000

# Check WebSocket info
curl http://localhost:3001/ws/info
```

### 5. View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f frontend
docker-compose -f docker-compose.production.yml logs -f mongodb
```

---

## Direct Deployment

### 1. Backend (Python)

```bash
# Install dependencies
cd /path/to/tacn
pip install -r requirements.txt

# Setup environment
cp .env.production.example .env
# Edit .env with your configuration

# Start backend (production mode)
python scripts/start_v2_production.py

# Or with uvicorn directly
uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --log-level info
```

### 2. TypeScript API Server

```bash
# Install dependencies
cd ts_services
npm install

# Build TypeScript
npm run build

# Start TypeScript server
NODE_ENV=production npm start

# Or with PM2
pm2 start build/server.js --name tacn-ts-api
```

### 3. Frontend

```bash
# Install dependencies
cd frontend
npm install

# Build for production
npm run build

# Serve with nginx (recommended)
# Copy dist/ to nginx web root
```

### 4. Nginx Configuration

```nginx
# /etc/nginx/sites-available/tacn

upstream backend {
    server localhost:8000;
}

upstream ts_api {
    server localhost:3001;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/tacn.crt;
    ssl_certificate_key /etc/ssl/private/tacn.key;

    # WebSocket upgrade
    location /ws {
        proxy_pass http://ts_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # TypeScript API v2
    location /api/v2 {
        proxy_pass http://ts_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Python backend
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Configuration

### Environment Variables

See `.env.production.example` for all available variables.

### Key Configuration Areas

1. **Security**: JWT secrets, database passwords
2. **Database**: MongoDB connection strings
3. **Cache**: Redis configuration
4. **CORS**: Allowed origins for API
5. **LLM**: OpenAI/Anthropic API keys
6. **Data Sources**: Tushare/AKShare/BaoStock tokens

### MongoDB Initialization

Create `scripts/mongodb-init.js`:

```javascript
// MongoDB initialization script
db = db.getSiblingDB('tacn_production');

// Create user
db.createUser({
  user: 'tacn_user',
  pwd: '${MONGODB_PASSWORD}',
  roles: [
    { role: 'readWrite', db: 'tacn_production' }
  ]
});

// Create initial indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.analysis_tasks.createIndex({ user_id: 1, created_at: -1 });
db.watchlists.createIndex({ user_id: 1 });
```

---

## Monitoring

### Health Endpoints

```bash
# Python backend
curl http://localhost:8000/api/health

# TypeScript API
curl http://localhost:3001/health

# WebSocket info
curl http://localhost:3001/ws/info

# Quote subscriptions
curl http://localhost:3001/ws/quotes/subscriptions
```

### Prometheus Metrics (Optional)

Enable monitoring profile:

```bash
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Log Monitoring

```bash
# Follow backend logs
docker-compose -f docker-compose.production.yml logs -f backend

# Check error logs
docker-compose -f docker-compose.production.yml logs | grep ERROR
```

---

## Rollback

### Docker Rollback

```bash
# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Start previous version (if tagged)
docker-compose -f docker-compose.production.yml up -d

# Or restore from backup
docker volume restore mongodb-data-backup
```

### Database Rollback

```bash
# Restore from backup
mongorestore --uri="mongodb://tacn_user:password@localhost:27017/tacn_production" \
  --drop /path/to/backup
```

---

## Troubleshooting

### Common Issues

#### 1. TypeScript Server Won't Start

```bash
# Check if port is in use
lsof -i :3001

# Check logs
docker-compose -f docker-compose.production.yml logs backend
```

#### 2. WebSocket Connection Fails

- Check JWT token is valid
- Verify CORS origins include your domain
- Check firewall allows WebSocket upgrade

#### 3. Database Connection Issues

```bash
# Check MongoDB is running
docker-compose -f docker-compose.production.yml logs mongodb

# Test connection
mongosh "mongodb://tacn_user:password@localhost:27017/tacn_production"
```

#### 4. High Memory Usage

- Reduce `WORKERS` in `.env.production`
- Disable unused features (set `*_ENABLED=false`)
- Increase MongoDB cache size

---

## Performance Tuning

### Backend Workers

```bash
# Adjust based on CPU cores
WORKERS=4  # 1-2 workers per CPU core
```

### MongoDB

```bash
# Increase WiredTiger cache
--wiredTigerCacheSizeGB=4
```

### Redis

```bash
# Set maxmemory policy
--maxmemory 2gb
--maxmemory-policy allkeys-lru
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Configure `CORS_ORIGINS` to specific domains
- [ ] Enable HTTPS/TLS
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure backup strategy
- [ ] Set up monitoring alerts

---

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review configuration: `.env.production`
- Verify prerequisites: Python 3.10+, Node.js 20+, MongoDB 7.0

---

## Next Steps

After deployment:
1. Create admin user via `/api/v2/auth/register`
2. Configure LLM providers in system settings
3. Set up data source API keys
4. Verify WebSocket connections
5. Configure monitoring alerts
