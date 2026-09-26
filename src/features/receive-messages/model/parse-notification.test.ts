import { describe, expect, it } from "vitest";
import { incomingExtendedTextMessage } from "@test/fixtures/green-api/incoming-extended-text-message";
import {
  incomingGroupTextMessage,
  incomingTextMessage,
} from "@test/fixtures/green-api/incoming-text-message";
import {
  incomingImageMessage,
  outgoingMessageStatus,
} from "@test/fixtures/green-api/ignored-notifications";
import { outgoingApiMessage } from "@test/fixtures/green-api/outgoing-api-message";
import { outgoingMessage } from "@test/fixtures/green-api/outgoing-message";
import { parseNotification } from "./parse-notification";

describe("parseNotification", () => {
  it("parses an incoming textMessage", () => {
    expect(parseNotification(incomingTextMessage)).toEqual({
      chatId: "10000000",
      chatName: "Василиса Премудрая",
      id: "1763115112345",
      text: "Я использую GREEN-API для отправки этого сообщения!",
      direction: "in",
      viaApi: false,
      timestamp: 1763115112000,
    });
  });

  it("parses an incoming extendedTextMessage", () => {
    expect(parseNotification(incomingExtendedTextMessage)).toEqual({
      chatId: "10000000",
      chatName: "Василиса",
      id: "1763115112345",
      text: "Я использую GREEN-API для отправки этого сообщения! Документация на сайте https://green-api.com/",
      direction: "in",
      viaApi: false,
      timestamp: 1770351383000,
    });
  });

  it("parses an outgoing message sent from the phone", () => {
    expect(parseNotification(outgoingMessage)).toMatchObject({
      id: "1763115112345",
      direction: "out",
      viaApi: false,
    });
  });

  it("parses an outgoing message sent via API", () => {
    expect(parseNotification(outgoingApiMessage)).toMatchObject({
      id: "1763115112345",
      text: "Я использую GREEN-API для отправки этого сообщения!",
      direction: "out",
      viaApi: true,
    });
  });

  it("leaves out an empty chatName", () => {
    const body = {
      ...incomingTextMessage,
      senderData: { ...incomingTextMessage.senderData, chatName: "" },
    };
    const message = parseNotification(body);
    expect(message).not.toBeNull();
    expect(message?.chatName).toBeUndefined();
    expect(message).not.toHaveProperty("chatName");
  });

  it("accepts a private chat without chatType", () => {
    const { chatType: _, ...senderData } = incomingTextMessage.senderData;
    expect(parseNotification({ ...incomingTextMessage, senderData })).toMatchObject({
      chatId: "10000000",
    });
  });

  describe("ignores", () => {
    it("a message status", () => {
      expect(parseNotification(outgoingMessageStatus)).toBeNull();
    });

    it("media", () => {
      expect(parseNotification(incomingImageMessage)).toBeNull();
    });

    it("an unknown typeWebhook", () => {
      expect(
        parseNotification({ ...incomingTextMessage, typeWebhook: "stateInstanceChanged" }),
      ).toBeNull();
    });

    it("a group message", () => {
      expect(parseNotification(incomingGroupTextMessage)).toBeNull();
    });

    it("a non-user chatType", () => {
      const senderData = { ...incomingTextMessage.senderData, chatType: "supergroup" };
      expect(parseNotification({ ...incomingTextMessage, senderData })).toBeNull();
    });

    it("a negative chatId without chatType", () => {
      const { chatType: _, ...rest } = incomingTextMessage.senderData;
      const senderData = { ...rest, chatId: "-10000000000000" };
      expect(parseNotification({ ...incomingTextMessage, senderData })).toBeNull();
    });
  });

  it("leaves out a non-string chatName", () => {
    const body = {
      ...incomingTextMessage,
      senderData: { ...incomingTextMessage.senderData, chatName: 42 },
    };
    const message = parseNotification(body);
    expect(message).toMatchObject({ chatId: "10000000" });
    expect(message).not.toHaveProperty("chatName");
  });

  describe("ignores a chatId that is not a positive integer", () => {
    it.each([
      ["zero", "0"],
      ["a leading zero", "0123"],
      ["an empty string", ""],
    ])("%s", (_, chatId) => {
      const senderData = { ...incomingTextMessage.senderData, chatId };
      expect(parseNotification({ ...incomingTextMessage, senderData })).toBeNull();
    });
  });

  describe("returns null for a malformed body", () => {
    it.each([
      ["null", null],
      ["a string", "incomingMessageReceived"],
      ["a number", 42],
      ["undefined", undefined],
    ])("%s", (_, body) => {
      expect(parseNotification(body)).toBeNull();
    });

    it("without senderData", () => {
      const { senderData: _, ...body } = incomingTextMessage;
      expect(parseNotification(body)).toBeNull();
    });

    it("without messageData", () => {
      const { messageData: _, ...body } = incomingTextMessage;
      expect(parseNotification(body)).toBeNull();
    });

    it("without textMessageData", () => {
      const body = { ...incomingTextMessage, messageData: { typeMessage: "textMessage" } };
      expect(parseNotification(body)).toBeNull();
    });

    it("with an empty idMessage", () => {
      expect(parseNotification({ ...incomingTextMessage, idMessage: "" })).toBeNull();
    });

    it("with a non-numeric timestamp", () => {
      expect(parseNotification({ ...incomingTextMessage, timestamp: "1763115112" })).toBeNull();
    });

    it("with a non-string chatId", () => {
      const senderData = { ...incomingTextMessage.senderData, chatId: 10000000 };
      expect(parseNotification({ ...incomingTextMessage, senderData })).toBeNull();
    });
  });
});
