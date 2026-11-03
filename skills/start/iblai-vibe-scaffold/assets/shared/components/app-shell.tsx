"use client";

import { Component, ReactNode } from "react";
import { StoreProvider } from "@/providers/store-provider";
import { Providers } from "@/providers";

/** Catch provider errors so the app shows a message instead of a blank page. */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-sm font-medium text-red-600">Something went wrong</p>
          <pre className="max-w-xl overflow-auto rounded bg-gray-100 p-4 text-xs text-gray-700">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Providers>{children}</Providers>
      </StoreProvider>
    </ErrorBoundary>
  );
}
