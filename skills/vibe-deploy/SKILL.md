---
name: vibe-deploy
description: Deploy your iblai app to production
globs:
alwaysApply: false
---

# /vibe-deploy

Deploy your iblai-powered app to production.

## Vercel (Recommended for Web)

1. **Push to GitHub**

2. **Deploy**:
   ```bash
   npx vercel --prod
   ```
   Or connect your repo in the Vercel dashboard for automatic deployments.

3. **Set environment variables** in Vercel dashboard:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
   NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
   NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
   NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
   NEXT_PUBLIC_MAIN_TENANT_KEY=your-tenant
   ```

## Docker

1. **Build**:
   ```bash
   docker build -t my-app .
   ```

2. **Run**:
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app \
     -e NEXT_PUBLIC_AUTH_URL=https://login.iblai.app \
     my-app
   ```

   The app uses `public/env.js` for runtime environment injection -- no rebuild needed for env changes.

## Desktop & Mobile (Tauri v2)

### Prerequisites
- Rust toolchain (`rustup`)
- Platform-specific deps (Xcode for macOS/iOS, Android SDK for Android)

### Add Tauri support
```bash
iblai add builds
```

### Build for current platform
```bash
iblai builds build
```

### iOS
```bash
iblai builds ios init    # One-time setup (macOS only)
pnpm tauri:dev:ios       # Dev in Simulator
pnpm tauri:build:ios     # Build .ipa
```

### Android
```bash
iblai builds android init
iblai builds android dev
iblai builds android build
```

### Windows MSIX
```bash
pnpm tauri:build:msix
```

### Generate app icons
```bash
iblai builds generate-icons logo.png
```

### CI/CD
```bash
iblai builds ci-workflow --all    # Generate GitHub Actions for all platforms
```
