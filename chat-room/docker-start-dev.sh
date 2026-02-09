#!/bin/bash

# Development environment script
echo "========================================="
echo "  Chat Room - Development Mode"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your DeepSeek API key"
fi

# Start development containers
echo "Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "✅ Development environment started!"
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:8080"
echo "  - Backend: http://localhost:3000"
echo "  - AI Service: http://localhost:5000"
echo ""
echo "Logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "Stop: docker-compose -f docker-compose.dev.yml down"
