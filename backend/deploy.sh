#!/bin/bash

# Railway Deployment Script
echo "🚀 Preparing for Railway deployment..."

# Remove pnpm files if they exist
rm -f pnpm-lock.yaml
rm -rf node_modules

# Install with npm
echo "📦 Installing dependencies with npm..."
npm install

# Create production build
echo "🔨 Creating production build..."
npm run build

echo "✅ Deployment preparation completed!"
echo "📋 Next steps:"
echo "1. Commit your changes: git add . && git commit -m 'Fix Railway deployment'"
echo "2. Push to GitHub: git push"
echo "3. Railway will auto-deploy with npm configuration"
echo "4. Check Railway logs for successful build" 