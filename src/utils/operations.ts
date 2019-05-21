import map from "lodash/map";
import template from "lodash/template";
import toPairs from "lodash/toPairs";
import zipObject from "lodash/zipObject";
import moment, { Moment } from "moment";

import { get, post } from "./api";
import { CONSTANTS } from "./constants";
import { upsert } from "./db";

import { MessageBodyMarkdown } from "../../generated/definitions/api/MessageBodyMarkdown";
import { MessageContent } from "../../generated/definitions/api/MessageContent";
import { MessageResponseWithContent } from "../../generated/definitions/api/MessageResponseWithContent";
import { MessageSubject } from "../../generated/definitions/api/MessageSubject";
import { PaginatedCreatedMessageWithoutContentCollection } from "../../generated/definitions/api/PaginatedCreatedMessageWithoutContentCollection";
import { PaymentData } from "../../generated/definitions/api/PaymentData";
import { ProblemJson } from "../../generated/definitions/api/ProblemJson";
import { Timestamp } from "../../generated/definitions/api/Timestamp";

import Database = PouchDB.Database;
const { CSV, CSV_HEADERS } = CONSTANTS;

const templateSettings = { interpolate: /{{([\s\S]+?)}}/g };

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
  useGrouping: false
});

interface ProfileGetAndPersistParams {
  db: Database;
  dbName?: string;
  url?: string;
  code: string;
  batchId?: string;
}

export function isError<T>(
  res: T | ProblemJson | undefined
): res is ProblemJson | undefined {
  return (
    typeof res === "undefined" || (res as ProblemJson).status !== undefined
  );
}

export async function profileGetAndPersist(params: ProfileGetAndPersistParams) {
  const { db, dbName, url, code, batchId } = params;
  const profile = await get<
    PaginatedCreatedMessageWithoutContentCollection | ProblemJson
  >({
    dbName,
    url,
    path: `profiles/${code}`
  });

  const newDoc = Object.assign(
    {
      type: "contact",
      batchId
    },
    isError(profile) // The API returns errors with shape { detail, status, title }
      ? { sender_allowed: null, status: profile.status } // Create an errored profile
      : profile
  );

  return upsert(db, code, newDoc);
}

interface MessagePostAndPersistParams {
  db: Database;
  code: string;
  content: MessageContent;
  templateId: string;
  batchId?: string;
}

enum MessageStatusValue {
  ACCEPTED = "ACCEPTED",
  THROTTLED = "THROTTLED",
  FAILED = "FAILED",
  PROCESSED = "PROCESSED"
}

enum NotificationChannelStatusValue {
  SENT = "SENT",
  THROTTLED = "THROTTLED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED"
}

interface DetailsOnError {
  message: {
    created_at: string;
    fiscal_code: string;
  } & ProblemJson;
}

interface MessagePostAndPersistFail extends DetailsOnError {
  _id: string;
}

interface MessagePostAndPersistSuccess extends MessageResponseWithContent {
  _id: string;
}

export type MessagePostAndPersistResult =
  | MessagePostAndPersistSuccess
  | MessagePostAndPersistFail;

export type ErroredPersistingMessage = DetailsOnError & {
  type: "message";
  templateId: string;
  batchId: string;
  status: "NOTSENT";
};

export type PersistingMessage = MessageResponseWithContent & {
  type: "message";
  templateId: string;
  batchId: string;
};

export async function messagePostAndPersist({
  db,
  code,
  content,
  templateId,
  batchId = ""
}: MessagePostAndPersistParams): Promise<MessagePostAndPersistResult> {
  const sent = await post<{ id: string } | ProblemJson | undefined>({
    path: `messages/${code}`,
    options: {
      body: JSON.stringify({
        time_to_live: 3600,
        content
      })
    }
  });

  // The API returns errors with shape { detail, status, title } or undefined
  if (isError(sent)) {
    const detailsOnError: DetailsOnError = {
      message: {
        created_at: new Date().toISOString(),
        fiscal_code: code,
        ...sent
      }
    };

    // Create an errored message
    const operation = await db.post<ErroredPersistingMessage>({
      ...detailsOnError,
      type: "message",
      templateId,
      batchId,
      status: "NOTSENT"
    });

    return {
      ...detailsOnError,
      _id: operation.id
    };
  }

  const details = await get<MessageResponseWithContent>({
    path: `messages/${code}/${sent.id}`
  });

  await db.put<PersistingMessage>({
    ...details,
    _id: sent.id,
    type: "message",
    templateId,
    batchId
  });
  return {
    ...details,
    _id: sent.id
  };
}

interface CreateMessageContentParams {
  message: { subject: string; markdown: string };
  dueDate: Moment | string | null;
  amount?: string;
  notice?: string;
  dueDateFormat: string;
}

export function createMessageContent({
  message,
  dueDate,
  amount,
  notice,
  dueDateFormat
}: CreateMessageContentParams): MessageContent {
  const subjectDecoding = MessageSubject.decode(message.subject);
  const markdownDecoding = MessageBodyMarkdown.decode(message.markdown);
  if (subjectDecoding.isLeft() || markdownDecoding.isLeft()) {
    // TODO: handle error
    throw new Error("Wrong parameters format");
  }
  const dueDateDecoding = Timestamp.decode(
    dueDate && moment(dueDate, dueDateFormat).toISOString()
  );
  const dueDateValue = dueDateDecoding.isRight()
    ? dueDateDecoding.value
    : undefined;
  const content: MessageContent = {
    subject: subjectDecoding.value,
    markdown: markdownDecoding.value,
    due_date: dueDateValue
  };

  const paymentDataDecoding = PaymentData.decode({
    amount: amount && amount.valueOf(),
    notice_number: notice
  });

  return paymentDataDecoding.isRight()
    ? {
        ...content,
        payment_data: paymentDataDecoding.value
      }
    : content;
}

export function getMessageValues(row: ReadonlyArray<string>) {
  if (!row) {
    return { amount: "" };
  }

  return toPairs(CSV).reduce(
    (previousValues, keyIndexTuple) => {
      const [key, index] = keyIndexTuple;
      return {
        ...previousValues,
        [CSV_HEADERS[key]]: row[index]
      };
    },
    {
      amount: ""
    }
  );
}

const interpolateAmount = (amountString: string) => {
  if (!!amountString) {
    // Amount is in Euro `cents`
    const amount = Number(amountString) / 100;
    const formatParts = currencyFormatter.formatToParts(amount);
    /* `formatParts` is now;
    [
      {
        "type": "integer",
        "value": "1"
      },
      ...
    ]
    */

    const parts = zipObject(
      map(formatParts, "type"),
      map(formatParts, "value")
    );
    /* `parts` is now
      {
        "integer": "1",
        "decimal": ",",
        "fraction": "23",
        "literal": " ",
        "currency": "€"
      }
    */
    const { integer, fraction, currency } = parts;
    return `${integer}.${fraction}${currency}`;
  }

  return "";
};

export function interpolateMarkdown(
  markdown: string,
  row: ReadonlyArray<string>
) {
  const compiled = template(markdown, templateSettings);
  const messageValues = getMessageValues(row);

  const values = {
    ...messageValues,
    value: interpolateAmount(messageValues.amount)
  };

  return compiled(values);
}

export default {
  profileGetAndPersist,
  createMessageContent,
  getMessageValues,
  interpolateMarkdown
};
