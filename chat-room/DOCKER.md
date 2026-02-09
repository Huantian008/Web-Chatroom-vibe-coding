# Docker Deployment Guide

## Quick Start

### Production Environment

1. **Setup environment variables**:
```bash
cp .env.example .env
# Edit .env with your actual values
```

2. **Start services**:
```bash
chmod +x docker-start.sh
./docker-start.sh
```

3. **Access the application**:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- MongoDB: mongodb://localhost:27017

### Development Environment

1. **Start development environment**:
```bash
chmod +x docker-start-dev.sh
./docker-start-dev.sh
```

2. **Features**:
- Hot reload enabled
- Volumes mounted for code editing
- Logs output to console

## Useful Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ai-service
docker-compose logs -f mongodb
```

### Stop services
```bash
# Production
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml down

# Remove all data (including database)
docker-compose down -v
```

### Restart services
```bash
docker-compose restart
docker-compose restart backend
```

### Execute commands in containers
```bash
# Backend
docker-compose exec backend sh
docker-compose exec backend npm test

# AI Service
docker-compose exec ai-service sh
docker-compose exec ai-service pytest

# MongoDB
docker-compose exec mongodb mongosh
```

## Service Health Checks

All services include health checks. View status:
```bash
docker-compose ps
```

## Environment Variables

### Required Variables
- `MONGO_USER`: MongoDB username
- `MONGO_PASSWORD`: MongoDB password
- `MONGO_DATABASE`: Database name
- `JWT_SECRET`: JWT secret key (generate with: `openssl rand -base64 32`)
- `DEEPSEEK_API_KEY`: DeepSeek API key for AI service

### Optional Variables
- `NODE_ENV`: `production` or `development` (default: production)
- `PORT`: Backend port (default: 3000)
- `FLASK_ENV`: Flask environment (default: production)

## Volume Management

### Backup MongoDB
```bash
docker-compose exec mongodb mongodump --archive=/data/db/backup.gz
docker cp chat-room-mongodb:/data/db/backup.gz ./backup.gz
```

### Restore MongoDB
```bash
docker cp ./backup.gz chat-room-mongodb:/data/db/backup.gz
docker-compose exec mongodb mongorestore --archive=/data/db/backup.gz
```

## Troubleshooting

### Services not starting
```bash
# Check logs
docker-compose logs

# Check disk space
docker system df

# Clean up unused resources
docker system prune -a
```

### Database connection issues
```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker-compose exec backend sh -c "node -e 'console.log(process.env.MONGODB_URI)'"
```

### Permission issues
```bash
# Make scripts executable
chmod +x docker-start.sh docker-start-dev.sh
```

### Port conflicts
Edit `docker-compose.yml` to change port mappings:
```yaml
ports:
  - "3001:3000"  # Change to 3001
```

## Production Deployment

### Using reverse proxy (nginx)

Add this to your nginx config:
```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:8080;
    }
}
```

### Security recommendations
1. Use strong passwords
2. Change JWT_SECRET
3. Limit CORS origins in production
4. Enable HTTPS
5. Use firewall rules
6. Regular updates

## Monitoring

### Resource usage
```bash
docker stats
```

### Container logs
```bash
docker-compose logs --tail=100 -f
```

### Database stats
```bash
docker-compose exec mongodb mongosh --eval "db.stats()"
```
