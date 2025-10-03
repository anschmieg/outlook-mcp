#!/bin/bash

# Deployment script for Outlook MCP Server (HTTP Transport)

set -e

echo "🚀 Deploying Outlook MCP Server to Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please log in to Cloudflare:"
    wrangler login
fi

# Create KV namespace if it doesn't exist
echo "📦 Setting up KV namespace for token storage..."

# Check if KV namespace exists
if ! wrangler kv:namespace list | grep -q "OUTLOOK_TOKENS"; then
    echo "Creating KV namespace..."
    wrangler kv:namespace create "OUTLOOK_TOKENS"
    wrangler kv:namespace create "OUTLOOK_TOKENS" --preview
    
    echo ""
    echo "⚠️  Please update wrangler.toml with the KV namespace IDs shown above"
    echo ""
    read -p "Press Enter after updating wrangler.toml..."
fi

# Check for required environment variables
echo "🔧 Checking environment variables..."

missing_vars=()

if [ -z "$CLIENT_ID" ]; then
    missing_vars+=("CLIENT_ID")
fi

if [ -z "$CLIENT_SECRET" ]; then
    missing_vars+=("CLIENT_SECRET")
fi

if [ -z "$TENANT_ID" ]; then
    missing_vars+=("TENANT_ID")
fi

if [ -z "$BASE_URL" ]; then
    missing_vars+=("BASE_URL")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set them using:"
    for var in "${missing_vars[@]}"; do
        echo "  wrangler secret put $var"
    done
    echo ""
    read -p "Press Enter after setting all environment variables..."
fi

# Run tests before deployment
echo "🧪 Running tests..."
npm test

# Deploy to Cloudflare Workers
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your MCP server is now available at:"
echo "  🔗 https://$(wrangler whoami | grep -o '[^@]*$')/outlook-mcp-http"
echo ""
echo "Next steps:"
echo "1. Update your MCP client configuration to use the HTTP transport"
echo "2. Test authentication by calling the 'authenticate' tool"
echo "3. Visit the auth URL to complete OAuth flow"
echo ""
echo "For more information, see README-HTTP.md"