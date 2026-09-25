/**
 * Lifetime of persisted records (`withLocalStorage({ time })`). The default
 * (`MAX_SAFE_TIMEOUT`, ~24.8 days) would silently drop long-lived data such as the
 * credentials or the chat history. A finite number, not `Infinity`: `JSON.stringify` turns it
 * into `null`, and such a record counts as expired.
 */
export const PERSIST_TTL = 10 * 365 * 24 * 60 * 60 * 1000;
