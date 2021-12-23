// deno-lint-ignore-file no-unused-vars no-explicit-any no-empty
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

import { debug } from "../vendor/puppeteer/src/common/Debug.ts";

import { copy } from "https://deno.land/std@0.119.0/streams/conversion.ts";
import { readLines } from "https://deno.land/std@0.119.0/io/mod.ts";

import * as fs from "https://deno.land/std@0.119.0/node/fs.ts";
import * as path from "https://deno.land/std@0.119.0/node/path.ts";
import { promisify } from "https://deno.land/std@0.119.0/node/util.ts";

import { assert } from "../vendor/puppeteer/src/common/assert.ts";
import { debugError, helper } from "../vendor/puppeteer/src/common/helper.ts";
import { LaunchOptions } from "../vendor/puppeteer/src/node/LaunchOptions.ts";
import { Connection } from "../vendor/puppeteer/src/common/Connection.ts";
import { BrowserWebSocketTransport as WebSocketTransport } from "../vendor/puppeteer/src/common/BrowserWebSocketTransport.ts";
import { PipeTransport } from "../vendor/puppeteer/src/node/PipeTransport.ts";
import { Product } from "../vendor/puppeteer/src/common/Product.ts";
import { TimeoutError } from "../vendor/puppeteer/src/common/Errors.ts";

const renameAsync = promisify(fs.rename);
const unlinkAsync = promisify(fs.unlink);

const debugLauncher = debug("puppeteer:launcher");

const PROCESS_ERROR_EXPLANATION =
  `Puppeteer was unable to kill the process which ran the browser binary.
 This means that, on future Puppeteer launches, Puppeteer might not be able to launch the browser.
 Please check your open processes and ensure that the browser processes that Puppeteer launched have been killed.
 If you think this is a bug, please report it on the Puppeteer issue tracker.`;

export class BrowserRunner {
  private _product: Product;
  private _executablePath: string;
  private _processArguments: string[];
  private _userDataDir: string;
  private _isTempUserDataDir?: boolean;

  proc?: Deno.Process;
  connection: Connection | null = null;

  private _closed = true;
  private _listeners = [];
  private _processClosing!: Promise<void>;

  constructor(
    product: Product,
    executablePath: string,
    processArguments: string[],
    userDataDir: string,
    isTempUserDataDir?: boolean,
  ) {
    this._product = product;
    this._executablePath = executablePath;
    this._processArguments = processArguments;
    this._userDataDir = userDataDir;
    this._isTempUserDataDir = isTempUserDataDir;
  }

  start(options: LaunchOptions): void {
    const { handleSIGINT, handleSIGTERM, handleSIGHUP, dumpio, env, pipe } =
      options;
    let stdio: Array<"ignore" | "pipe">;
    if (pipe) {
      if (dumpio) stdio = ["ignore", "pipe", "pipe", "pipe", "pipe"];
      else stdio = ["ignore", "ignore", "ignore", "pipe", "pipe"];
    } else {
      if (dumpio) stdio = ["pipe", "pipe", "pipe"];
      else stdio = ["pipe", "ignore", "pipe"];
    }
    assert(!this.proc, "This process has previously been started.");
    debugLauncher(
      `Calling ${this._executablePath} ${this._processArguments.join(" ")}`,
    );

    function convertStdio(s: "ignore" | "pipe") {
      return s === "ignore" ? "null" : "piped";
    }

    this.proc = Deno.run({
      cmd: [this._executablePath, ...this._processArguments],
      // @ts-expect-error wrong type
      env,
      stdin: convertStdio(stdio[0]),
      stdout: convertStdio(stdio[1]),
      stderr: convertStdio(stdio[2]),
    });
    this._closed = false;
    this._processClosing = this.proc.status().then(async (status) => {
      this._closed = true;
      try {
        if (this.proc) {
          if (!status.success && dumpio) {
            await copy(this.proc.stdout!, Deno.stdout);
            await copy(this.proc.stderr!, Deno.stderr);
          }
          this.proc.stdin?.close();
          this.proc.stdout?.close();
          this.proc.stderr?.close();
          this.proc.close();
        }
        // Cleanup as processes exit.
        if (this._isTempUserDataDir) {
          await Deno.remove(this._userDataDir, {
            recursive: true,
          }).catch(() => {});
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.BadResource)) {
          throw err;
        }
      }
    });
  }

  close(): Promise<void> {
    if (this._closed) return Promise.resolve();
    if (this._isTempUserDataDir && this._product !== "firefox") {
      this.kill();
    } else if (this.connection) {
      // Attempt to close the browser gracefully
      this.connection.send("Browser.close").catch((error) => {
        debugError(error);
        this.kill();
      });
    }
    // Cleanup this listener last, as that makes sure the full callback runs. If we
    // perform this earlier, then the previous function calls would not happen.
    helper.removeEventListeners(this._listeners);
    return this._processClosing;
  }

  kill(): void {
    // If the process failed to launch (for example if the browser executable path
    // is invalid), then the process does not get a pid assigned. A call to
    // `proc.kill` would error, as the `pid` to-be-killed can not be found.
    // @ts-expect-error TS2551
    if (this.proc && this.proc.pid && !this.proc.killed) {
      try {
        this.proc.kill("SIGKILL");
      } catch (error) {
        throw new Error(
          `${PROCESS_ERROR_EXPLANATION}\nError cause: ${error.stack}`,
        );
      }
    }

    // Attempt to remove temporary profile directory to avoid littering.
    try {
      if (this._isTempUserDataDir) {
        Deno.removeSync(this._userDataDir, { recursive: true });
      }
    } catch (error) {}

    // Cleanup this listener last, as that makes sure the full callback runs. If we
    // perform this earlier, then the previous function calls would not happen.
    helper.removeEventListeners(this._listeners);
  }

  async setupConnection(options: {
    usePipe?: boolean;
    timeout: number;
    slowMo: number;
    preferredRevision: string;
  }): Promise<Connection> {
    const { usePipe, timeout, slowMo, preferredRevision } = options;
    if (!usePipe) {
      const browserWSEndpoint = await waitForWSEndpoint(
        // @ts-expect-error TS2345
        this.proc,
        timeout,
        preferredRevision,
      );
      const transport = await WebSocketTransport.create(browserWSEndpoint);
      this.connection = new Connection(browserWSEndpoint, transport, slowMo);
    } else {
      // stdio was assigned during start(), and the 'pipe' option there adds the
      // 4th and 5th items to stdio array
      // @ts-expect-error TS2532
      const { 3: pipeWrite, 4: pipeRead } = this.proc.stdio;
      const transport = new PipeTransport(
        pipeWrite as any,
        pipeRead as any,
      );
      this.connection = new Connection("", transport, slowMo);
    }
    return this.connection;
  }
}

async function waitForWSEndpoint(
  browserProcess: Deno.Process,
  timeout: number,
  preferredRevision: string,
): Promise<string> {
  const timeId = setTimeout(() => {
    throw new TimeoutError(
      `Timed out after ${timeout} ms while trying to connect to the browser! Only Chrome at revision r${preferredRevision} is guaranteed to work.`,
    );
  }, timeout);

  for await (const line of readLines(browserProcess.stderr!)) {
    const match = line.match(/^DevTools listening on (ws:\/\/.*)$/);
    if (match) {
      clearTimeout(timeId);
      return match[1];
    }
  }

  clearTimeout(timeId);
  throw new Error(
    [
      "Failed to launch the browser process!" + "",
      "TROUBLESHOOTING: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md",
      "",
    ].join("\n"),
  );
}
