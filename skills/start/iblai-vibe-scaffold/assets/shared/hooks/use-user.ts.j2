"use client";

import { useState } from "react";

/**
 * Get the username from localStorage userData.
 * Returns "anonymous" if not logged in.
 *
 * Reads synchronously during state initialization so the value
 * is available on the very first render (avoids flash / extra re-renders).
 */
export function useUsername(): string {
  const [username] = useState(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.user_nicename) return data.user_nicename;
      }
    } catch {
      // ignore parse errors
    }
    return "anonymous";
  });

  return username;
}

/**
 * Get the AXD token from localStorage.
 * Returns empty string if not available.
 *
 * Reads synchronously so the token is present on first render,
 * preventing the WebSocket from attempting to connect without it.
 */
export function useAxdToken(): string {
  const [token] = useState(() => localStorage.getItem("axd_token") ?? "");

  return token;
}
