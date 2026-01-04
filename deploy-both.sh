#!/bin/bash
# Deploy Both Production and Development Environments
# Run this script from the root directory

echo "🚀 Deploying FitApp Production and Development Environments"
echo "=========================================================="
echo ""

# Check if we're in the right directory
if [ ! -d "production" ] || [ ! -d "development" ]; then
    echo "❌ Error: production/ or development/ directory not found"
    echo "   Please run this script from the fitapp root directory"
    exit 1
fi

# Deploy Production
echo "📦 Step 1: Deploying Production Environment..."
echo "----------------------------------------------"
cd production

if [ ! -f ".env" ]; then
    echo "⚠️  Warning: production/.env not found"
    echo "   Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "   Please edit production/.env with your values"
        echo "   Then run this script again"
        exit 1
    fi
fi

if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
    if [ $? -ne 0 ]; then
        echo "❌ Production deployment failed!"
        exit 1
    fi
else
    echo "❌ deploy.sh not found in production/"
    exit 1
fi

cd ..

echo ""
echo "✅ Production deployment complete!"
echo ""

# Wait a moment
sleep 5

# Deploy Development
echo "🔧 Step 2: Deploying Development Environment..."
echo "------------------------------------------------"
cd development

if [ ! -f ".env" ]; then
    echo "⚠️  Warning: development/.env not found"
    echo "   Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "   Please edit development/.env with your values"
        echo "   Then run this script again"
        exit 1
    fi
fi

if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
    if [ $? -ne 0 ]; then
        echo "❌ Development deployment failed!"
        exit 1
    fi
else
    echo "❌ deploy.sh not found in development/"
    exit 1
fi

cd ..

echo ""
echo "🎉 Both environments deployed successfully!"
echo ""
echo "📊 Summary:"
echo "  Production:"
echo "    Frontend: http://localhost:5173 (https://fitapp.herringm.com)"
echo "    Backend:  http://localhost:3000 (https://fitappbackend.herringm.com)"
echo ""
echo "  Development:"
echo "    Frontend: http://localhost:5174 (https://fitappdev.herringm.com)"
echo "    Backend:  http://localhost:3001 (https://fitappbackenddev.herringm.com)"
echo ""
echo "✅ Both environments are running and can be used simultaneously!"

