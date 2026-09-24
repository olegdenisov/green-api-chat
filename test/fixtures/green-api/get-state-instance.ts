// https://green-api.com/telegram/docs/api/account/GetStateInstance/
import type { GetStateInstanceResponse } from "@/shared/api";

export const getStateInstanceResponse = {
  stateInstance: "authorized",
} satisfies GetStateInstanceResponse;
