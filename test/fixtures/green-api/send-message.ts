// https://green-api.com/telegram/docs/api/sending/SendMessage/
import type { SendMessageRequest, SendMessageResponse } from "@/shared/api";

export const sendMessageRequest = {
  chatId: "10000000",
  message: "Я использую GREEN-API для отправки этого сообщения!",
} satisfies SendMessageRequest;

export const sendMessageResponse = {
  idMessage: "1769676078000",
} satisfies SendMessageResponse;
