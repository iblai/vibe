import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "My App",
  description: "AI Agent powered by ibl.ai",
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
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
      <head />
      <body className="font-sans antialiased">
        <Script src="/env.js" strategy="afterInteractive" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
