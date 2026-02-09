#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "  Chat Room - Docker Setup Script"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env file created. Please update it with your configuration.${NC}"
    else
        echo -e "${RED}❌ .env.example not found. Please create .env file manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file found.${NC}"
fi

# Check if .env has been configured
if grep -q "your_secure_password_here" .env || grep -q "your_deepseek_api_key_here" .env; then
    echo -e "${YELLOW}⚠️  Please update .env with your actual values before starting.${NC}"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to cancel..."
fi

# Build and start services
echo ""
echo "========================================="
echo "  Building Docker images..."
echo "========================================="
docker-compose build

echo ""
echo "========================================="
echo "  Starting services..."
echo "========================================="
docker-compose up -d

echo ""
echo "========================================="
echo "  Checking service status..."
echo "========================================="
sleep 5
docker-compose ps

echo ""
echo -e "${GREEN}✅ Services started successfully!${NC}"
echo ""
echo "Access the application at:"
echo "  - Frontend: http://localhost:8080"
echo "  - Backend API: http://localhost:3000"
echo "  - AI Service: http://localhost:5000"
echo "  - MongoDB: mongodb://localhost:27017"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart services: docker-compose restart"
echo "  - Remove all data: docker-compose down -v"
echo ""
