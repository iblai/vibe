import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { IblaiProviders } from "@/providers/iblai-providers";

// Open Sans is the ibl.ai face; globals.css maps --font-open-sans to --font-sans.
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

// The middleware's nonce-based CSP requires per-request rendering: a statically
// prerendered page ships nonce-less <script> tags that enforce mode blocks
// (strict-dynamic disables 'self'/https: fallbacks), white-screening the
// deployed app. Remove this only if the CSP middleware goes too.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "vibe-starter",
  description: "Built on the ibl.ai platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <IblaiProviders>{children}</IblaiProviders>
      </body>
    </html>
  );
}
