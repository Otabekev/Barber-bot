import uz from "./locales/uz.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const LOCALES = { uz, en, ru };

// Maps language code to a locale string for toLocaleDateString()
export const DATE_LOCALE = {
  uz: "uz-UZ",
  en: "en-US",
  ru: "ru-RU",
};

/**
 * Translate a key for the given language.
 * Falls back to Uzbek, then returns the key itself.
 */
export function t(key, lang = "uz") {
  return LOCALES[lang]?.[key] ?? LOCALES.uz?.[key] ?? key;
}
