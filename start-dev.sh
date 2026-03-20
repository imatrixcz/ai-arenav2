#!/bin/bash
set -e

echo "=================================="
echo "AI Arena v2 - Development Setup"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_NAME=aiarena
MONGODB_URI=mongodb://mongodb:27017
REDIS_URI=redis:6379

# JWT Secrets
JWT_ACCESS_SECRET=dev-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# App Config
FRONTEND_URL=http://localhost:4290
APP_NAME=AI Arena
LASTSAAS_ENV=dev
EOF
    echo "✓ Created .env file"
fi

echo ""
echo "Building and starting services..."
docker-compose up -d mongodb redis

echo ""
echo "Waiting for MongoDB to be ready..."
sleep 5

echo ""
echo "Seeding database with test data..."
# Copy seed data to container and execute
docker cp scripts/seed-data.js aiarenav2-mongodb:/tmp/seed-data.js
docker exec aiarenav2-mongodb mongosh aiarena --quiet /tmp/seed-data.js || echo "⚠️  Seed data may have already been applied"

echo ""
echo "Building application..."
docker-compose build app

echo ""
echo "Starting application..."
docker-compose up -d app

echo ""
echo "=================================="
echo "✅ AI Arena v2 is starting up!"
echo "=================================="
echo ""
echo "📱 Application: http://localhost:4290"
echo "🗄️  MongoDB:     mongodb://localhost:27017"
echo "🎨 MongoDB UI:  http://localhost:8081 (admin/admin)"
echo "💾 Redis:       redis://localhost:6379"
echo ""
echo "Logs: docker-compose logs -f app"
echo "Stop: docker-compose down"
echo ""
