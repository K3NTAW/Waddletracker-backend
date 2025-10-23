#!/bin/bash

# WaddleTracker Backend Deployment Script

echo "🚀 Starting WaddleTracker Backend Deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Please create one from env.example"
    echo "   Required environment variables:"
    echo "   - DATABASE_URL"
    echo "   - DISCORD_CLIENT_ID"
    echo "   - DISCORD_CLIENT_SECRET"
    echo "   - JWT_SECRET"
    echo "   - FRONTEND_URL"
fi

# Build the project
echo "🏗️  Building project..."
npm run build

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set up your PostgreSQL database"
echo "2. Configure environment variables"
echo "3. Run 'npm run db:push' to set up the database schema"
echo "4. Deploy to Vercel or your preferred platform"
echo ""
echo "🔗 Useful commands:"
echo "   npm run dev          - Start development server"
echo "   npm run db:push      - Push schema to database"
echo "   npm run db:studio    - Open Prisma Studio"
echo "   vercel deploy        - Deploy to Vercel"
