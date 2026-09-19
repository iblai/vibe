import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, OPENEDX_LOCALE_COOKIE, resolveLocale } from "./config";

/**
 * next-intl request config. Locale comes from cookies — the shared platform
 * preference first, then this app's own — deliberately *not* from the URL, so
 * no route needs a `[locale]` segment and no middleware changes.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(
    cookieStore.get(OPENEDX_LOCALE_COOKIE)?.value ??
      cookieStore.get(LOCALE_COOKIE)?.value,
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
