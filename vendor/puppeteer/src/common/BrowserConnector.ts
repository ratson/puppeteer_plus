/**
 * Copyright 2020 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConnectionTransport } from './ConnectionTransport.ts';
import { Browser } from './Browser.ts';
import { assert } from 'https://deno.land/std@0.93.0/testing/asserts.ts';
import { debugError } from '../common/helper.ts';
import { Connection } from './Connection.ts';
import { Viewport } from './PuppeteerViewport.ts';
import { isNode } from '../environment.ts';

/**
 * Generic browser options that can be passed when launching any browser or when
 * connecting to an existing browser instance.
 * @public
 */
export interface BrowserConnectOptions {
  /**
   * Whether to ignore HTTPS errors during navigation.
   * @defaultValue false
   */
  ignoreHTTPSErrors?: boolean;
  /**
   * Sets the viewport for each page.
   */
  defaultViewport?: Viewport | null;
  /**
   * Slows down Puppeteer operations by the specified amount of milliseconds to
   * aid debugging.
   */
  slowMo?: number;
}

const getWebSocketTransportClass = async () => {
  return (await import('./BrowserWebSocketTransport.ts'))
        .BrowserWebSocketTransport;
};

/**
 * Users should never call this directly; it's called when calling
 * `puppeteer.connect`.
 * @internal
 */
export const connectToBrowser = async (
  options: BrowserConnectOptions & {
    browserWSEndpoint?: string;
    browserURL?: string;
    transport?: ConnectionTransport;
  }
): Promise<Browser> => {
  const {
    browserWSEndpoint,
    browserURL,
    ignoreHTTPSErrors = false,
    defaultViewport = { width: 800, height: 600 },
    transport,
    slowMo = 0,
  } = options;

  assert(
    Number(!!browserWSEndpoint) + Number(!!browserURL) + Number(!!transport) ===
      1,
    'Exactly one of browserWSEndpoint, browserURL or transport must be passed to puppeteer.connect'
  );

  // @ts-expect-error TS7034
  let connection = null;
  if (transport) {
    connection = new Connection('', transport, slowMo);
  } else if (browserWSEndpoint) {
    const WebSocketClass = await getWebSocketTransportClass();
    const connectionTransport: ConnectionTransport = await WebSocketClass.create(
      browserWSEndpoint
    );
    connection = new Connection(browserWSEndpoint, connectionTransport, slowMo);
  } else if (browserURL) {
    const connectionURL = await getWSEndpoint(browserURL);
    const WebSocketClass = await getWebSocketTransportClass();
    const connectionTransport: ConnectionTransport = await WebSocketClass.create(
      connectionURL
    );
    connection = new Connection(connectionURL, connectionTransport, slowMo);
  }

  // @ts-expect-error TS2531
  const { browserContextIds } = await connection.send(
    'Target.getBrowserContexts'
  );
  return Browser.create(
    // @ts-expect-error TS2345
    connection,
    browserContextIds,
    ignoreHTTPSErrors,
    defaultViewport,
    null,
    // @ts-expect-error TS7005
    () => connection.send('Browser.close').catch(debugError)
  );
};

async function getWSEndpoint(browserURL: string): Promise<string> {
  const endpointURL = new URL('/json/version', browserURL);

  try {
    const result = await fetch(endpointURL.toString(), {
      method: 'GET',
    });
    if (!result.ok) {
      throw new Error(`HTTP ${result.statusText}`);
    }
    const data = await result.json();
    return data.webSocketDebuggerUrl;
  } catch (error) {
    error.message =
      `Failed to fetch browser webSocket URL from ${endpointURL}: ` +
      error.message;
    throw error;
  }
}
