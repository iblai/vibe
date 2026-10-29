import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { IblaiProviders } from "@/providers/iblai-providers";
import config from "@/lib/iblai/config";
import { APP_SLUG } from "@/lib/iblai/metadata-core";

// Open Sans is the ibl.ai face; globals.css maps --font-open-sans to --font-sans.
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

// The middleware's nonce-based CSP requires per-request rendering: a statically
// prerendered page ships nonce-less <script> tags that enforce mode blocks
// (strict-dynamic disables 'self'/https: fallbacks), white-screening the
// deployed app. Remove this only if the CSP middleware goes too.
export const dynamic = "force-dynamic";

// The tab until the org's settings load; AppTitle then shows the name saved on /setup.
export const metadata: Metadata = {
  title: config.appName() || APP_SLUG,
  description: "Built on the ibl.ai platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // <html lang> follows the resolved locale. Hardcoding "en" misreports the
  // document language to screen readers and crawlers as soon as a second
  // locale ships (WCAG 3.1.1).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <IblaiProviders>{children}</IblaiProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
