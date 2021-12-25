import { Protocol } from "./deps.ts";

export interface OnResponseReceivedEvent {
  request: Protocol.Network.Request;
  response: InterceptedResponse;
}

export type OnInterceptionEvent = Protocol.Fetch.RequestPausedEvent;

export interface EventHandlers {
  onResponseReceived?: (
    event: OnResponseReceivedEvent,
  ) => Promise<InterceptedResponse | void> | InterceptedResponse | void;
  onInterception?: (
    event: OnInterceptionEvent,
    control: ControlCallbacks,
  ) => Promise<void> | void;
}

export interface ResponseOptions {
  responseHeaders?: Protocol.Fetch.HeaderEntry[];
  binaryResponseHeaders?: string;
  body?: string;
  responsePhrase?: string;
  encodedBody?: string;
}

export interface ControlCallbacks {
  abort: (msg: Protocol.Network.ErrorReason) => void;
  fulfill: (responseCode: number, responseOptions?: ResponseOptions) => void;
}

export interface InterceptedResponse {
  body: string;
  headers: Protocol.Fetch.HeaderEntry[] | undefined;
  errorReason?: Protocol.Network.ErrorReason;
  statusCode: number;
  base64Body?: string;
  statusMessage?: string;
}
