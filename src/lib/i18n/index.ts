export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_HTML_LANG,
  parseLocale,
  type Locale,
} from "./config";
export { translate, type MessageKey, type Messages } from "./messages";
export { getRequestLocale, tServer } from "./server";
