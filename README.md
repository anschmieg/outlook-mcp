# Outlook MCP Server - HTTP Transport (Cloudflare Workers)

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/ryaker-outlook-mcp-badge.png)](https://mseep.ai/app/ryaker-outlook-mcp)

This is the HTTP transport version of the Outlook MCP (Model Context Protocol) server, designed to run as a Cloudflare Worker. It connects Claude with Microsoft Outlook through the Microsoft Graph API using HTTP instead of stdio transport.

## 🚀 Quick Start

### 1. Azure App Registration

First, register an app in Azure Portal:

1. Open [Azure Portal](https://portal.azure.com/)
2. Navigate to "App registrations" → "New registration"
3. Enter name: "Outlook MCP Server HTTP"
4. Select "Accounts in any organizational directory and personal Microsoft accounts"
5. Set redirect URI: `https://your-worker-domain.workers.dev/auth/callback`
6. Copy the **Application (client) ID**

### 2. Configure Permissions

In your app registration:
1. Go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"
2. Add these permissions:
   - `offline_access`
   - `User.Read`
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `Calendars.Read`
   - `Calendars.ReadWrite`

### 3. Create Client Secret

1. Go to "Certificates & secrets" → "Client secrets" → "New client secret"
2. Add description and set expiration
3. Copy the **secret value**

### 4. Deploy to Cloudflare Workers

```bash
# Install dependencies
npm install

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace for tokens
wrangler kv:namespace create "OUTLOOK_TOKENS"
wrangler kv:namespace create "OUTLOOK_TOKENS" --preview

# Update wrangler.toml with your KV namespace IDs

# Set environment variables
wrangler secret put CLIENT_ID
wrangler secret put CLIENT_SECRET
wrangler secret put TENANT_ID
wrangler secret put BASE_URL

# Deploy
npm run deploy
```

### 5. Set Environment Variables

In Cloudflare Dashboard → Workers → Your Worker → Settings → Environment Variables:

```
CLIENT_ID=your-azure-app-client-id
CLIENT_SECRET=your-azure-app-client-secret
TENANT_ID=your-azure-tenant-id-or-common
BASE_URL=https://your-worker-domain.workers.dev
```

## 🔌 MCP Client Configuration

Configure your MCP client to use HTTP transport:

```json
{
  "mcpServers": {
    "outlook-http": {
      "transport": {
        "type": "http",
        "url": "https://your-worker-domain.workers.dev/mcp"
      }
    }
  }
}
```

## 🛠️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP JSON-RPC 2.0 endpoint |
| `/auth/start` | GET | Start OAuth authentication |
| `/auth/callback` | GET | OAuth callback handler |
| `/health` | GET | Health check |

## 🔐 Authentication Flow

1. Call the `authenticate` tool to get the auth URL
2. Visit the URL to authenticate with Microsoft
3. You'll be redirected back to the callback endpoint
4. Tokens are stored in Cloudflare KV
5. Use other tools to access Outlook data

## 📧 Available Tools

### Authentication
- `about` - Server information
- `authenticate` - Start authentication flow
- `check-auth-status` - Check authentication status

### Email Management
- `list-emails` - List recent emails
- `search-emails` - Search emails with filters
- `read-email` - Read specific email content
- `send-email` - Send new emails
- `mark-as-read` - Mark emails as read/unread

### Calendar Management
- `list-events` - List upcoming events
- `create-event` - Create new calendar events
- `cancel-event` - Cancel events
- `delete-event` - Delete events
- `decline-event` - Decline event invitations

### Folder Management
- `list-folders` - List mail folders
- `create-folder` - Create new folders
- `move-emails` - Move emails between folders

### Rules Management
- `list-rules` - List inbox rules
- `create-rule` - Create new inbox rules
- `edit-rule-sequence` - Modify rule execution order

## 🧪 Testing

### Automated Tests
- Run Jest suite: `npm test`
  - Includes HTTP worker tests for `/health`, `/mcp initialize`, `/mcp tools/list`, and auth tool basics.
  - Legacy SSE and file-based token tests are excluded for this HTTP refactor.

### Manual HTTP Testing (Local)
- Start local Worker: `npm run dev` (or `npx wrangler dev src/worker.js`)
- Health check:
  - `curl http://localhost:8787/health | jq .`
- Initialize (JSON-RPC):
  - `curl -s -X POST http://localhost:8787/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq .`
- List tools:
  - `curl -s -X POST http://localhost:8787/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .`
- Start auth flow (tool):
  - `curl -s -X POST http://localhost:8787/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"authenticate","arguments":{}}}' | jq .`
- Start auth flow (endpoint):
  - `curl -s http://localhost:8787/auth/start | jq .`

Tip: `./test-direct.sh` runs a local dev server and performs the above checks automatically.

### Manual HTTP Testing (Deployed)
- After `npm run deploy`, replace the base URL with your Worker domain:
  - `curl https://your-worker.workers.dev/health`
  - `curl -X POST https://your-worker.workers.dev/mcp ...`

### MCP Inspector
- MCP Inspector supports stdio and SSE, but not the HTTP JSON-RPC transport used here.
- Use curl/httpie for manual HTTP testing, or configure an MCP client that supports `transport.type = "http"`.

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/JSON-RPC    ┌──────────────────┐
│   MCP Client    │ ◄─────────────────► │ Cloudflare Worker │
│   (Claude)      │                     │   (HTTP Server)   │
└─────────────────┘                     └──────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │ Microsoft Graph  │
                                        │       API        │
                                        └──────────────────┘
                                                 ▲
                                                 │
                                        ┌──────────────────┐
                                        │  Cloudflare KV   │
                                        │  (Token Storage) │
                                        └──────────────────┘
```

## 🔄 Migration from stdio Version

The HTTP version maintains compatibility with all existing tools while providing:

- **Serverless deployment** - No need for persistent servers
- **Automatic scaling** - Cloudflare handles traffic spikes
- **Global edge deployment** - Low latency worldwide
- **Secure token storage** - Encrypted KV storage
- **HTTP transport** - Works with any HTTP client

## 🐛 Troubleshooting

### Authentication Issues
- Verify redirect URI matches exactly
- Check tenant ID (use 'common' for multi-tenant)
- Ensure all required permissions are granted

### KV Storage Issues
- Verify KV namespace is created and bound
- Check environment variables are set
- Monitor KV usage in Cloudflare dashboard

### API Call Failures
- Check token expiration and refresh
- Verify Microsoft Graph API permissions
- Review Cloudflare Worker logs

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLIENT_ID` | Azure app client ID | `your-azure-app-client-id` |
| `CLIENT_SECRET` | Azure app client secret | `your-azure-app-client-secret` |
| `TENANT_ID` | Azure tenant ID (optional) | `your-azure-tenant-id-or-common` |
| `BASE_URL` | Worker base URL | `https://your-worker-domain.workers.dev` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
