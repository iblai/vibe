---
name: iblai-iconography
description: Generate every required app-icon size for Tauri desktop, iOS, Windows MSIX, and macOS builds from a single source image. Use when the user mentions app icons, icon generation, iconography, favicons, replacing the logo, or needs the full icon set for a desktop/mobile build. The ready-made default ibl.ai icon set ships in iblai-ops-build/assets/icons/.
globs:
alwaysApply: false
---

# Generate Tauri App Icons

Generate all required icon sizes for Tauri desktop, iOS, Windows MSIX,
and macOS builds from a single source image.

> The default ibl.ai icon set (every size below) is bundled at
> [`iblai-ops-build/assets/icons/`](../iblai-ops-build/assets/icons/) —
> copy it into `src-tauri/icons/` as a starting point, or regenerate from
> your own logo with the commands here.

---

## Quick Start

```bash
# Option A — Tauri's built-in (standard desktop/mobile icons, no MSIX)
# Requires @tauri-apps/cli + Rust toolchain:
pnpm exec tauri icon path/to/logo.png

# Option B — ImageMagick (the full set INCLUDING the MSIX logos below)
# Requires `convert`; one resize per target size, e.g.:
for s in 32x32 128x128 256x256; do \
  convert path/to/logo.png -resize $s -gravity center -background none \
    -extent $s -alpha on PNG32:src-tauri/icons/$s.png; done
```

Both write to `src-tauri/icons/`, overwriting existing files. For the complete
MSIX size list plus the multi-resolution `.ico` / `.icns` recipe, see
[`/iblai-ops-build` → builds-command](../iblai-ops-build/references/builds-command.md).

---

## Source Image Requirements

- **Format**: PNG or SVG
- **Shape**: Square recommended (1:1 aspect ratio)
- **Size**: Minimum 512x512 pixels for best quality at all output sizes
- **Non-square images**: Centered on a transparent square canvas (letterboxed)

---

## ImageMagick Installation

Required for the ImageMagick path (the full MSIX set). Not needed for `pnpm exec tauri icon`.

| Platform | Command |
|----------|---------|
| macOS | `brew install imagemagick` |
| Ubuntu/Debian | `sudo apt install imagemagick` |
| Arch Linux | `sudo pacman -S imagemagick` |
| Fedora/RHEL | `sudo dnf install ImageMagick` |
| Windows | `winget install ImageMagick.ImageMagick` |

If ImageMagick is not installed, use `pnpm exec tauri icon` (standard set,
no MSIX logos).

---

## Generated Icon Files

All icons are written to `src-tauri/icons/`:

### Tauri Bundle Icons (referenced in `tauri.conf.json`)

| File | Size | Used by |
|------|------|---------|
| `32x32.png` | 32x32 | Taskbar, file explorer |
| `128x128.png` | 128x128 | App launcher |
| `128x128@2x.png` | 256x256 | macOS HiDPI (Retina) |
| `icon.png` | 256x256 | Fallback / source |
| `icon.ico` | 16+32+48+256 | Windows executable icon |
| `icon.icns` | 128x128 | macOS app bundle |

### MSIX Icons (referenced in `AppxManifest.xml`)

| File | Size | Used by |
|------|------|---------|
| `StoreLogo.png` | 50x50 | Microsoft Store listing |
| `Square44x44Logo.png` | 44x44 | Taskbar |
| `Square71x71Logo.png` | 71x71 | Start menu (small) |
| `Square150x150Logo.png` | 150x150 | Start menu (medium) |
| `Square310x310Logo.png` | 310x310 | Start menu (large) |
| `Wide310x150Logo.png` | 310x150 | Start menu (wide tile) |

---

## Comparison: ImageMagick vs `tauri icon`

| Feature | ImageMagick (`convert`) | `pnpm exec tauri icon` |
|---------|------------------------------|-------------------|
| Tauri bundle icons (PNG, ICO, ICNS) | Yes | Yes |
| MSIX icons (StoreLogo, Square*, Wide*) | Yes | No |
| Multi-resolution ICO | Yes (16+32+48+256) | Yes |
| macOS ICNS | Yes | Yes |
| Requires | ImageMagick (`convert`) | `@tauri-apps/cli` + Rust |
| Transparent background | Always | Depends on source |
| Non-square handling | Centers on transparent canvas | Resizes/crops |

**Recommendation**: Use **ImageMagick** if you plan to build MSIX packages
(Windows Store / enterprise). Use **`pnpm exec tauri icon`** if you only need
standard desktop builds (NSIS, MSI, DMG, AppImage).

---

## Default Icons

Generated apps ship with ibl.ai logo icons as defaults. Replace them
with your own logo at any time:

```bash
pnpm exec tauri icon my-company-logo.png        # standard set
# (+ the ImageMagick step from Quick Start for the MSIX logos)
```

---

## Regenerating After Logo Change

Simply re-run with the new source image:

```bash
pnpm exec tauri icon path/to/new-logo.png       # standard set
# (+ the ImageMagick step from Quick Start for the MSIX logos)
```

All icons in `src-tauri/icons/` are overwritten. Commit the updated icons.

---

## Troubleshooting

### "Icon is not RGBA"

Tauri requires RGBA PNGs (with alpha channel for transparency).
The ImageMagick recipe always produces RGBA output (`PNG32:` + `-alpha on`).
If using a different tool, verify your PNGs:

```bash
# Check format
file src-tauri/icons/icon.png
# Should show: PNG image data, 256 x 256, 8-bit/color RGBA

# Convert RGB to RGBA with ImageMagick
convert icon.png -alpha on icon-rgba.png
```

### Icons look small / too much padding

Non-square source images are centered on a transparent canvas, which
can leave large borders at small sizes. For best results, use a square
source image (1:1 aspect ratio) at 512x512 or larger.

### "convert: not found" or "command not found"

Install ImageMagick for your platform (see table above), or use
Tauri's built-in icon generator instead:

```bash
pnpm exec tauri icon path/to/logo.png
```

### Icons not updating in the built app

After regenerating icons, rebuild the Tauri app:

```bash
pnpm exec tauri build
# or for MSIX:
pnpm tauri:build:msix
```

The old icons may be cached in `src-tauri/target/`. To force a clean build:

```bash
rm -rf src-tauri/target
pnpm exec tauri build
```
