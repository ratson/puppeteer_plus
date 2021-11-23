import { Protocol } from "../vendor/devtools-protocol/types/protocol.d.ts";
import { debug as DEBUG } from "../vendor/puppeteer/src/common/Debug.ts";
import { CDPSession, Page } from "../core.ts";
import { pick } from "https://deno.land/x/stdx@0.6.0/collections/pick.ts";
import * as Interceptor from "./interceptor.ts";

const debug = DEBUG("puppeteer-interceptor");

export * from "./types.ts";
export * from "./request-patterns.ts";

export class InterceptionHandler {
  page: Page;
  patterns: Protocol.Fetch.RequestPattern[] = [];
  eventHandlers: Interceptor.EventHandlers = {};
  client?: CDPSession;
  disabled = false;
  constructor(
    page: Page,
    patterns: Protocol.Fetch.RequestPattern[] = [],
    eventHandlers: Interceptor.EventHandlers = {},
  ) {
    this.page = page;
    this.patterns = patterns;
    this.eventHandlers = eventHandlers;
  }
  disable() {
    this.disabled = true;
  }
  enable() {
    this.disabled = false;
  }
  async initialize() {
    const client = await this.page.target().createCDPSession();
    await client.send("Fetch.enable", { patterns: this.patterns });
    client.on(
      "Fetch.requestPaused",
      async (event: Protocol.Fetch.RequestPausedEvent) => {
        const { requestId, request } = event;

        if (this.disabled) {
          debug(`Interception handler disabled, continuing request.`);
          await client.send("Fetch.continueRequest", { requestId });
          return;
        }

        debug(`Request ${event.request.url} (${requestId}) paused.`);

        if (this.eventHandlers.onInterception) {
          let errorReason: Protocol.Network.ErrorReason = "Aborted";
          let shouldContinue = true;
          let fulfill: undefined | (() => Promise<void>) = undefined;
          const control = {
            abort: (msg: Protocol.Network.ErrorReason) => {
              shouldContinue = false;
              errorReason = msg;
            },
            fulfill: (
              responseCode: number,
              responseOptions?: Interceptor.ResponseOptions,
            ): void => {
              const fulfillOptions: Protocol.Fetch.FulfillRequestRequest = {
                requestId,
                responseCode,
              };
              if (responseOptions) {
                const keys = [
                  "body",
                  "binaryResponseHeaders",
                  "responseHeaders",
                  "responsePhrase",
                ];
                Object.assign(
                  fulfillOptions,
                  pick(responseOptions as any, keys),
                );
                if (fulfillOptions.body) {
                  fulfillOptions.body = btoa(
                    fulfillOptions.body,
                  );
                }
                if (responseOptions.encodedBody) {
                  fulfillOptions.body = responseOptions.encodedBody;
                }
              }
              fulfill = async () => {
                debug(
                  `Fulfilling request ${requestId} with responseCode "${responseCode}"`,
                );
                await client.send("Fetch.fulfillRequest", fulfillOptions);
              };
            },
          };

          await this.eventHandlers.onInterception(event, control);
          if (!shouldContinue) {
            debug(`Aborting request ${requestId} with reason "${errorReason}"`);
            await client.send("Fetch.failRequest", { requestId, errorReason });
            return;
          } else if (fulfill) {
            await (fulfill as () => Promise<void>)();
            return;
          }
        }

        let newResponse = null;

        if (this.eventHandlers.onResponseReceived) {
          if (!event.responseStatusCode) {
            debug(
              `Warning: onResponseReceived handler passed but ${requestId} intercepted at Request stage. Handler can not be called.`,
            );
          } else {
            const responseCdp = (await client.send("Fetch.getResponseBody", {
              requestId,
            })) as Protocol.Fetch.GetResponseBodyResponse;
            const response: Interceptor.InterceptedResponse = {
              body: responseCdp.base64Encoded
                ? atob(responseCdp.body)
                : responseCdp.body,
              headers: event.responseHeaders,
              errorReason: event.responseErrorReason,
              statusCode: event.responseStatusCode,
            };
            newResponse = await this.eventHandlers.onResponseReceived({
              response,
              request,
            });
          }
        }

        if (newResponse) {
          debug(
            `Fulfilling request ${requestId} with response returned from onResponseReceived`,
          );
          await client.send("Fetch.fulfillRequest", {
            requestId,
            responseCode: newResponse.statusCode,
            responseHeaders: newResponse.headers,
            body: newResponse.base64Body
              ? newResponse.base64Body
              : btoa(newResponse.body),
            responsePhrase: newResponse.statusMessage,
          });
        } else {
          await client.send("Fetch.continueRequest", { requestId });
        }
      },
    );
  }
}

export async function intercept(
  page: Page,
  patterns: Protocol.Fetch.RequestPattern[] = [],
  eventHandlers: Interceptor.EventHandlers = {},
) {
  debug(`Registering interceptors for ${patterns.length} patterns`);
  const interceptionHandler = new InterceptionHandler(
    page,
    patterns,
    eventHandlers,
  );
  await interceptionHandler.initialize();
  return interceptionHandler;
}
