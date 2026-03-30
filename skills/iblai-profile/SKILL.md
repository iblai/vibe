---
name: iblai-profile
description: Add profile dropdown and settings page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-profile

Add user profile features -- a compact avatar dropdown for your navbar and
a full settings page with tabs for Basic info, Social links, Education,
Experience, Resume, and Security.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.

## Add Profile

```bash
iblai add profile
# or: npx @iblai/cli add profile
```

```bash
pnpm install
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/profile/page.tsx` | Full profile settings page using SDK `Profile` component |
| `components/iblai/profile-dropdown.tsx` | Avatar dropdown with profile link, tenant switching, logout |

## Usage

### Profile Dropdown (navbar)

```tsx
import { ProfileDropdown } from "@/components/iblai/profile-dropdown";

<ProfileDropdown />
```

### Profile Page

Accessible at `/profile`. Shows 7 tabs:
- Basic info (name, bio, avatar)
- Social links
- Education
- Experience
- Resume
- Security (password change)

## Verify

```bash
pnpm dev
```

Log in, click the avatar dropdown, then navigate to the profile page.

## Detailed Guide

For the complete implementation reference:
https://github.com/iblai/iblai-app-cli/blob/main/skills/components/iblai-add-profile.md
