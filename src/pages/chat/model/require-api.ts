import { greenApiAtom } from "@/entities/session";
import type { GreenApi } from "@/shared/api";

/**
 * The current GREEN-API client. Throws without credentials: the chat screen is shown only
 * with them, so a call from it while logged out is a programmer error.
 */
export function requireApi(): GreenApi {
  const api = greenApiAtom();
  if (!api) throw new Error("No GREEN-API client (logged out)");
  return api;
}
