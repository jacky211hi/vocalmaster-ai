import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { translate, type MessageKey } from "./messages";

export async function getRequestLocale(): Promise<Locale> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function tServer(
  key: MessageKey,
  vars?: Record<string, string | number>
): Promise<string> {
  const locale = await getRequestLocale();
  return translate(locale, key, vars);
}
