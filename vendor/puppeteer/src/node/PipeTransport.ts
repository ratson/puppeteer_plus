/**
 * Copyright 2018 Google Inc. All rights reserved.
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
import { Buffer } from 'https://deno.land/std@0.123.0/node/buffer.ts';
import {
  helper,
  debugError,
  PuppeteerEventListener,
} from '../common/helper.ts';
import { ConnectionTransport } from '../common/ConnectionTransport.ts';

export class PipeTransport implements ConnectionTransport {
  _pipeWrite: any;
  _pendingMessage: string;
  _eventListeners: PuppeteerEventListener[];

  onclose?: () => void;
  onmessage?: () => void;

  constructor(
    pipeWrite: any,
    pipeRead: any
  ) {
    this._pipeWrite = pipeWrite;
    this._pendingMessage = '';
    this._eventListeners = [
      helper.addEventListener(pipeRead, 'data', (buffer) =>
        this._dispatch(buffer)
      ),
      helper.addEventListener(pipeRead, 'close', () => {
        if (this.onclose) this.onclose.call(null);
      }),
      helper.addEventListener(pipeRead, 'error', debugError),
      helper.addEventListener(pipeWrite, 'error', debugError),
    ];
    // @ts-expect-error TS2322
    this.onmessage = null;
    // @ts-expect-error TS2322
    this.onclose = null;
  }

  send(message: string): void {
    this._pipeWrite.write(message);
    this._pipeWrite.write('\0');
  }

  _dispatch(buffer: Buffer): void {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingMessage += buffer.toString();
      return;
    }
    const message = this._pendingMessage + buffer.toString(undefined, 0, end);
    // @ts-expect-error TS2554
    if (this.onmessage) this.onmessage.call(null, message);

    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      if (this.onmessage)
        // @ts-expect-error TS2554
        this.onmessage.call(null, buffer.toString(undefined, start, end));
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingMessage = buffer.toString(undefined, start);
  }

  close(): void {
    this._pipeWrite = null;
    helper.removeEventListeners(this._eventListeners);
  }
}
