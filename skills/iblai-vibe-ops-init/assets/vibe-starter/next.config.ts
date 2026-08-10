// ibl.ai: Node.js 22+ localStorage polyfill (missing getItem/setItem in SSR)
if (typeof window === "undefined" && typeof localStorage !== "undefined" && typeof localStorage.getItem !== "function") {
  const _s: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => (_s[k] ?? null),
    setItem: (k: string, v: string) => { _s[k] = String(v); },
    removeItem: (k: string) => { delete _s[k]; },
    clear: () => { for (const k in _s) delete _s[k]; },
    get length() { return Object.keys(_s).length; },
    key: (i: number) => Object.keys(_s)[i] ?? null,
  } as Storage;
}

import type { NextConfig } from "next";
import { createRequire } from "module";


const require = createRequire(import.meta.url);

/**
 * Resolve a package to its root directory so webpack never loads duplicate
 * copies (can happen in npm/pnpm hoisting with differing peer deps).
 * Without this, @reduxjs/toolkit may be duplicated and SDK components get
 * a different ReactReduxContext — RTK Query hooks silently return undefined.
 */
function dedup(packageName: string): string | undefined {
  try {
    const entry = require.resolve(packageName);
    const marker = `node_modules/${packageName}`;
    const idx = entry.lastIndexOf(marker);
    if (idx !== -1) return entry.slice(0, idx + marker.length);
    return undefined;
  } catch {
    return undefined;
  }
}

const resolveAliases: Record<string, string> = {};
const dataLayerDir = dedup("@iblai/data-layer");
if (dataLayerDir) resolveAliases["@iblai/data-layer"] = dataLayerDir;
const rtkDir = dedup("@reduxjs/toolkit");
if (rtkDir) resolveAliases["@reduxjs/toolkit"] = rtkDir;
const reactReduxDir = dedup("react-redux");
if (reactReduxDir) resolveAliases["react-redux"] = reactReduxDir;

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  turbopack: {},
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // ibl.ai: Deduplicate @reduxjs/toolkit + react-redux (shared Redux context)
    Object.assign(config.resolve.alias, resolveAliases);
    return config;
  },
};

export default nextConfig;
