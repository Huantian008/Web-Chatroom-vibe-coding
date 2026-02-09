# Makefile for Chat Room Project

.PHONY: help build dev prod start stop restart logs clean test install docker-build docker-up docker-down docker-logs docker-clean docker-prune

# Default target
help:
	@echo "Chat Room - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start development environment with Docker"
	@echo "  make install     - Install all dependencies"
	@echo "  make test        - Run all tests"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build    - Build Docker images"
	@echo "  make docker-up       - Start production containers"
	@echo "  make docker-down     - Stop containers"
	@echo "  make docker-restart  - Restart containers"
	@echo "  make docker-logs     - View container logs"
	@echo "  make docker-clean    - Stop and remove containers"
	@echo "  make docker-prune    - Remove all Docker data (including volumes)"
	@echo ""
	@echo "Backend:"
	@echo "  make backend-install  - Install backend dependencies"
	@echo "  make backend-start    - Start backend server"
	@echo "  make backend-test     - Run backend tests"
	@echo ""
	@echo "AI Service:"
	@echo "  make ai-install       - Install AI service dependencies"
	@echo "  make ai-start        - Start AI service"
	@echo "  make ai-test         - Run AI service tests"
	@echo ""
	@echo "Frontend:"
	@echo "  make frontend-start   - Start frontend server"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell        - Open MongoDB shell"
	@echo "  make db-backup       - Backup MongoDB database"
	@echo "  make db-restore      - Restore MongoDB database"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean           - Clean temporary files"
	@echo "  make format          - Format code"
	@echo "  make lint            - Run linter"
	@echo ""

# ========================================
# Development
# ========================================

dev:
	@./docker-start-dev.sh

install: backend-install ai-install

test: backend-test ai-test

# ========================================
# Docker Commands
# ========================================

docker-build:
	@echo "Building Docker images..."
	docker-compose build

docker-up:
	@echo "Starting containers..."
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Please update .env with your configuration"; \
	fi
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@docker-compose ps

docker-down:
	@echo "Stopping containers..."
	docker-compose down

docker-restart:
	@echo "Restarting containers..."
	docker-compose restart

docker-logs:
	docker-compose logs -f

docker-clean:
	@echo "Stopping and removing containers..."
	docker-compose down -v

docker-prune:
	@echo "Removing all Docker data..."
	docker-compose down -v
	docker system prune -f

# ========================================
# Backend Commands
# ========================================

backend-install:
	@echo "Installing backend dependencies..."
	cd backend && npm install

backend-start:
	@echo "Starting backend server..."
	cd backend && npm start

backend-test:
	@echo "Running backend tests..."
	cd backend && npm test

backend-dev:
	@echo "Starting backend in development mode..."
	cd backend && npm run dev

# ========================================
# AI Service Commands
# ========================================

ai-install:
	@echo "Installing AI service dependencies..."
	cd ai-service && \
	if [ ! -d .venv ]; then \
		python3 -m venv .venv; \
	fi && \
	. .venv/bin/activate && \
	pip install -r requirements.txt

ai-start:
	@echo "Starting AI service..."
	cd ai-service && \
	. .venv/bin/activate && \
	python app.py

ai-test:
	@echo "Running AI service tests..."
	cd ai-service && \
	. .venv/bin/activate && \
	pytest test_app.py -v

# ========================================
# Frontend Commands
# ========================================

frontend-start:
	@echo "Starting frontend server..."
	cd frontend && python3 -m http.server 8080

# ========================================
# Database Commands
# ========================================

db-shell:
	@echo "Opening MongoDB shell..."
	docker-compose exec mongodb mongosh

db-backup:
	@echo "Backing up MongoDB..."
	@mkdir -p backups
	docker-compose exec mongodb mongodump --archive=/data/db/backup-$$(date +%Y%m%d-%H%M%S).gz
	docker cp chat-room-mongodb:/data/db/backup-$$(ls -t backups | head -1) backups/

db-restore:
	@echo "Restoring MongoDB from backup..."
	@echo "Usage: make db-restore BACKUP=backup-filename.gz"
	docker cp backups/$(BACKUP) chat-room-mongodb:/data/db/restore.gz
	docker-compose exec mongodb mongorestore --archive=/data/db/restore.gz

# ========================================
# Utilities
# ========================================

clean:
	@echo "Cleaning temporary files..."
	find . -name "*.log" -delete
	find . -name ".DS_Store" -delete
	find . -name "*.tmp" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true

format:
	@echo "Formatting code..."
	@npm list -g prettier >/dev/null 2>&1 || npm install -g prettier
	prettier --write "backend/**/*.js" "frontend/**/*.js" "frontend/**/*.css"

lint:
	@echo "Running linter..."
	@cd backend && npm list eslint >/dev/null 2>&1 || npm install -g eslint
	eslint backend/**/*.js

# ========================================
# Production Deployment
# ========================================

deploy-prod:
	@echo "Deploying to production..."
	@if [ -z $$CI ]; then \
		echo "Warning: Running outside CI/CD pipeline"; \
	fi
	docker-compose -f docker-compose.yml up -d
	@echo "Production deployment complete!"

# ========================================
# Monitoring
# ========================================

status:
	@echo "Container Status:"
	@docker-compose ps
	@echo ""
	@echo "Resource Usage:"
	@docker stats --no-stream

health:
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health | jq '.' || echo "Backend: Not healthy"
	@curl -s http://localhost:5000/health | jq '.' || echo "AI Service: Not healthy"
	@curl -s http://localhost:8080/ > /dev/null && echo "Frontend: Healthy" || echo "Frontend: Not healthy"
