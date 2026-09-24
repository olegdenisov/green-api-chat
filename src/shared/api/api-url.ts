const HOST_PREFIX_LENGTH = 4;

/**
 * Derives the API host from `idInstance`: its first 4 digits form the subdomain,
 * e.g. "4100000000" → "https://4100.api.green-api.com".
 * Returns `undefined` when the id is too short or has non-digits: the user enters
 * `apiUrl` manually then.
 */
export function resolveApiUrl(idInstance: string): string | undefined {
  const id = idInstance.trim();
  if (id.length < HOST_PREFIX_LENGTH || !/^\d+$/.test(id)) {
    return undefined;
  }
  return `https://${id.slice(0, HOST_PREFIX_LENGTH)}.api.green-api.com`;
}
