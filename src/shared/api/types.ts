// Types follow the GREEN-API Telegram docs (https://green-api.com/telegram/docs/).
// There is no runtime validation: responses are cast to these types.

/** Instance credentials from the GREEN-API console. */
export type Credentials = {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
};

// --- Account ---

export type StateInstance =
  | "notAuthorized"
  | "authorized"
  | "blocked"
  | "suspended"
  | "starting"
  | "pendingPassword";

export type GetStateInstanceResponse = {
  stateInstance: StateInstance;
};

export type YesNo = "yes" | "no";

/** Instance settings as returned by `getSettings`. */
export type Settings = {
  wid: string;
  typeInstance: string;
  /** Must be empty to receive notifications over HTTP API. */
  webhookUrl: string;
  webhookUrlToken: string;
  delaySendMessagesMilliseconds: number;
  markIncomingMessagesReaded: YesNo;
  markIncomingMessagesReadedOnReply: YesNo;
  outgoingWebhook: YesNo;
  outgoingMessageWebhook: YesNo;
  outgoingAPIMessageWebhook: YesNo;
  incomingWebhook: YesNo;
  stateWebhook: YesNo;
  keepOnlineStatus: YesNo;
  editedMessageWebhook: YesNo;
  deletedMessageWebhook: YesNo;
};

/** `setSettings` body: any subset of the writable settings (`wid`/`typeInstance` are read-only). */
export type SettingsPatch = Partial<Omit<Settings, "wid" | "typeInstance">>;

export type SetSettingsResponse = {
  saveSettings: boolean;
};

// --- Service methods ---

export type CheckAccountResult =
  | {
      exist: true;
      chatId: string;
      username?: string;
      phoneNumber?: number;
      fromCache?: boolean;
    }
  | {
      /** No Telegram account, or the number is hidden by privacy settings. */
      exist: false;
      chatId: string;
      fromCache?: boolean;
    };

/**
 * Failure reported with HTTP 200. Telegram rate limit:
 * `{ status: false, data: { status: "fail", reason: "rate_limit_exceeded", retryAfter } }`;
 * instance not ready: `{ status: false, reason: "instance is starting or not authorized" }`.
 */
export type CheckAccountFailure = {
  status: false;
  reason?: string;
  data?: {
    status: string;
    reason: string;
    retryAfter?: number;
  };
};

/** Raw `checkAccount` body: a result or a failure with HTTP 200. */
export type CheckAccountResponse = CheckAccountResult | CheckAccountFailure;

// --- Sending ---

export type SendMessageRequest = {
  /** Telegram chat id: a number as a string, without `@c.us`. */
  chatId: string;
  /** Up to 4096 characters. */
  message: string;
};

export type SendMessageResponse = {
  idMessage: string;
};

// --- Receiving ---

export type DeleteNotificationResponse = {
  result: boolean;
  /** Empty string on success. */
  reason?: string;
};

export type InstanceData = {
  idInstance: number;
  wid: string;
  typeInstance: string;
};

export type SenderData = {
  /** Private chat: positive number as a string; group: negative. */
  chatId: string;
  /** `user`, `supergroup`, ... Missing in some doc examples, hence optional. */
  chatType?: string;
  sender: string;
  chatName: string;
  senderName: string;
  senderType?: string;
  senderContactName?: string;
  senderPhoneNumber?: number;
};

export type QuotedMessage = {
  stanzaId: string;
  participant: string;
};

export type TextMessageData = {
  typeMessage: "textMessage";
  textMessageData: {
    textMessage: string;
    isForwarded?: boolean;
    forwardingScore?: number;
  };
  quotedMessage?: QuotedMessage;
};

/** Text with a link preview (or an ad message). */
export type ExtendedTextMessageData = {
  typeMessage: "extendedTextMessage";
  extendedTextMessageData: {
    text: string;
    description?: string;
    title?: string;
    sourceId?: string;
    jpegThumbnail?: string;
    thumbnailUrl?: string;
    isForwarded?: boolean;
    forwardingScore?: number;
  };
  quotedMessage?: QuotedMessage;
};

/**
 * Supported message kinds only. Other `typeMessage` values (media, etc.) do arrive at
 * runtime; the union has no catch-all member so that `switch` narrowing works, and
 * consumers must handle unknown kinds in a `default` branch.
 */
export type MessageData = TextMessageData | ExtendedTextMessageData;

type MessageNotificationBase = {
  instanceData: InstanceData;
  /** Unix time, seconds. */
  timestamp: number;
  idMessage: string;
  senderData: SenderData;
  messageData: MessageData;
};

export type IncomingMessageNotification = MessageNotificationBase & {
  typeWebhook: "incomingMessageReceived";
};

/** `outgoingMessageReceived` — sent from another client; `outgoingAPIMessageReceived` — via API. */
export type OutgoingMessageNotification = MessageNotificationBase & {
  typeWebhook: "outgoingMessageReceived" | "outgoingAPIMessageReceived";
};

/**
 * Status of a sent message (Telegram docs, `outgoingMessageStatus`). Requires the
 * `outgoingWebhook` setting. No `senderData`/`messageData`.
 */
export type OutgoingMessageStatusNotification = {
  typeWebhook: "outgoingMessageStatus";
  /** Telegram chat id; the `noAccount` doc example has a WhatsApp-style `…@c.us` id. */
  chatId: string;
  instanceData: InstanceData;
  /** Unix time, seconds. */
  timestamp: number;
  /** Present for `delivered`/`read`; the `failed`/`noAccount` doc examples have none. */
  idMessage?: string;
  status: "delivered" | "read" | "failed" | "noAccount";
  /** Error details, e.g. `media caption too long` for `failed`. */
  description?: string;
};

/**
 * Supported notification kinds only: messages and outgoing message statuses. Other
 * `typeWebhook` values (instance state, ...) do arrive at runtime; the union has no catch-all
 * member so that `switch` narrowing works, and consumers must handle unknown kinds in a
 * `default` branch.
 */
export type Notification =
  | IncomingMessageNotification
  | OutgoingMessageNotification
  | OutgoingMessageStatusNotification;

/** `receiveNotification` body; an empty queue yields `null`. */
export type ReceivedNotification = {
  receiptId: number;
  body: Notification;
};
