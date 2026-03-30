---
name: vibe-connect-backend
description: Connect your app to the iblai backend
globs:
alwaysApply: false
---

# /vibe-connect-backend

Connect your app to the iblai.app backend or your own tenant.

## Default Setup (iblai.app)

Apps scaffolded by the CLI connect to iblai.app out of the box. The default `.env.example`:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
NEXT_PUBLIC_MAIN_TENANT_KEY=iblai
```

This gives you:
- SSO authentication (client-side redirect, no API tokens)
- Access to AI agents/mentors
- Real-time WebSocket chat
- Analytics and user management

## Get Your Own Tenant (Free)

1. Register at **https://iblai.app**
2. Create an organization -- this is your **tenant key**
3. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_MAIN_TENANT_KEY=your-tenant-key
   ```
4. Create AI agents/mentors in the iblai.app dashboard
5. Set the agent ID:
   ```bash
   NEXT_PUBLIC_DEFAULT_AGENT_ID=your-agent-uuid
   ```

## How Auth Works

All authentication is **client-side SSO**:

1. User visits your app
2. `AuthProvider` checks for a valid session
3. If not authenticated, redirects to `NEXT_PUBLIC_AUTH_URL` (login.iblai.app)
4. User logs in (or registers) at iblai.app
5. Redirected back to your app's `/sso-login-complete` callback
6. Session stored in localStorage, user is authenticated

No API tokens, no server-side auth, no secrets to manage.

## Provider Chain

Your app must wrap pages in this exact provider order:

```tsx
<ReduxProvider store={store}>
  <AuthProvider>
    <TenantProvider>
      {children}
    </TenantProvider>
  </AuthProvider>
</ReduxProvider>
```

The `iblai add auth` command sets this up automatically.

## Self-Hosted Backend

If you run your own ibl.ai platform (via iblai-infra-cli), update all URLs:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_AUTH_URL=https://auth.yourdomain.com
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.yourdomain.com
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=yourdomain.com
NEXT_PUBLIC_MAIN_TENANT_KEY=your-org
```

## What the Backend Provides

| Service | Description |
|---------|-------------|
| SSO Authentication | User registration, login, password reset, social auth |
| AI Agents | Create and manage AI mentors with custom system prompts, tools, and LLM providers |
| Chat | Real-time streaming chat via WebSocket, message history, file attachments |
| Analytics | Usage stats, user analytics, topic analysis, financial reporting |
| Datasets | Upload documents, connect cloud storage, crawl websites for agent training |
| Multi-Tenancy | Isolated tenants with RBAC, custom branding, domain mapping |
| Billing | Stripe integration with subscription management and free trials |
