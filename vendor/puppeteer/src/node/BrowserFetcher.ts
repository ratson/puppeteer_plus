/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import process from 'https://deno.land/std@0.149.0/node/process.ts';
import { copy } from 'https://deno.land/std@0.149.0/fs/copy.ts';
import { copy as copyIO, writeAll } from 'https://deno.land/std@0.149.0/streams/conversion.ts';
import { extractZip } from '../../../../src/deps.ts';
import * as os from 'https://deno.land/std@0.149.0/node/os.ts';
import * as fs from 'https://deno.land/std@0.149.0/node/fs.ts';
import * as path from 'https://deno.land/std@0.149.0/node/path.ts';
import * as util from 'https://deno.land/std@0.149.0/node/util.ts';
import * as childProcess from 'https://deno.land/std@0.149.0/node/child_process.ts';
import * as https from 'https://deno.land/std@0.149.0/node/https.ts';
import * as http from 'https://deno.land/std@0.149.0/node/http.ts';

import {Product} from '../common/Product.ts';
import {debug} from '../common/Debug.ts';
import {promisify} from 'https://deno.land/std@0.149.0/node/util.ts';
import * as URL from 'https://deno.land/std@0.149.0/node/url.ts';
import {assert} from '../common/assert.ts';


const {PUPPETEER_EXPERIMENTAL_CHROMIUM_MAC_ARM} = process.env;

const debugFetcher = debug('puppeteer:fetcher');

const downloadURLs: Record<Product, Partial<Record<Platform, string>>> = {
  chrome: {
    linux: '%s/chromium-browser-snapshots/Linux_x64/%d/%s.zip',
    mac: '%s/chromium-browser-snapshots/Mac/%d/%s.zip',
    mac_arm: '%s/chromium-browser-snapshots/Mac_Arm/%d/%s.zip',
    win32: '%s/chromium-browser-snapshots/Win/%d/%s.zip',
    win64: '%s/chromium-browser-snapshots/Win_x64/%d/%s.zip',
  },
  firefox: {
    linux: '%s/firefox-%s.en-US.%s-x86_64.tar.bz2',
    mac: '%s/firefox-%s.en-US.%s.dmg',
    win32: '%s/firefox-%s.en-US.%s.zip',
    win64: '%s/firefox-%s.en-US.%s.zip',
  },
};

const browserConfig = {
  chrome: {
    host: 'https://storage.googleapis.com',
    destination: '.local-chromium',
  },
  firefox: {
    host: 'https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central',
    destination: '.local-firefox',
  },
} as const;

/**
 * Supported platforms.
 *
 * @public
 */
export type Platform = 'linux' | 'mac' | 'mac_arm' | 'win32' | 'win64';

function archiveName(
  product: Product,
  platform: Platform,
  revision: string
): string {
  switch (product) {
    case 'chrome':
      switch (platform) {
        case 'linux':
          return 'chrome-linux';
        case 'mac_arm':
        case 'mac':
          return 'chrome-mac';
        case 'win32':
        case 'win64':
          // Windows archive name changed at r591479.
          return parseInt(revision, 10) > 591479
            ? 'chrome-win'
            : 'chrome-win32';
      }
    case 'firefox':
      return platform;
  }
}

function downloadURL(
  product: Product,
  platform: Platform,
  host: string,
  revision: string
): string {
  const url = util.format(
    downloadURLs[product][platform],
    host,
    revision,
    archiveName(product, platform, revision)
  );
  return url;
}

function handleArm64(): void {
  let exists = fs.existsSync('/usr/bin/chromium-browser');
  if (exists) {
    return;
  }
  exists = fs.existsSync('/usr/bin/chromium');
  if (exists) {
    return;
  }
  console.error(
    'The chromium binary is not available for arm64.' +
      '\nIf you are on Ubuntu, you can install with: ' +
      '\n\n sudo apt install chromium\n' +
      '\n\n sudo apt install chromium-browser\n'
  );
  throw new Error();
}

const readdirAsync = promisify(fs.readdir.bind(fs));
const mkdirAsync = promisify(fs.mkdir.bind(fs));
const unlinkAsync = promisify(fs.unlink.bind(fs));
const chmodAsync = promisify(fs.chmod.bind(fs));

function existsAsync(filePath: string): Promise<boolean> {
  return new Promise(resolve => {
    fs.access(filePath, err => {
      return resolve(!err);
    });
  });
}

/**
 * @public
 */
export interface BrowserFetcherOptions {
  platform?: Platform;
  product?: string;
  path?: string;
  host?: string;
}

/**
 * @public
 */
export interface BrowserFetcherRevisionInfo {
  folderPath: string;
  executablePath: string;
  url: string;
  local: boolean;
  revision: string;
  product: string;
}
/**
 * BrowserFetcher can download and manage different versions of Chromium and Firefox.
 *
 * @remarks
 * BrowserFetcher operates on revision strings that specify a precise version of Chromium, e.g. `"533271"`. Revision strings can be obtained from {@link http://omahaproxy.appspot.com/ | omahaproxy.appspot.com}.
 * In the Firefox case, BrowserFetcher downloads Firefox Nightly and
 * operates on version numbers such as `"75"`.
 *
 * @example
 * An example of using BrowserFetcher to download a specific version of Chromium
 * and running Puppeteer against it:
 *
 * ```ts
 * const browserFetcher = puppeteer.createBrowserFetcher();
 * const revisionInfo = await browserFetcher.download('533271');
 * const browser = await puppeteer.launch({executablePath: revisionInfo.executablePath})
 * ```
 *
 * **NOTE** BrowserFetcher is not designed to work concurrently with other
 * instances of BrowserFetcher that share the same downloads directory.
 *
 * @public
 */

export class BrowserFetcher {
  #product: Product;
  #downloadsFolder: string;
  #downloadHost: string;
  #platform: Platform;

  /**
   * @internal
   */
  constructor(projectRoot: string, options: BrowserFetcherOptions = {}) {
    this.#product = (options.product || 'chrome').toLowerCase() as Product;
    assert(
      this.#product === 'chrome' || this.#product === 'firefox',
      `Unknown product: "${options.product}"`
    );

    this.#downloadsFolder =
      options.path ||
      path.join(projectRoot, browserConfig[this.#product].destination);
    this.#downloadHost = options.host || browserConfig[this.#product].host;

    if (options.platform) {
      this.#platform = options.platform;
    } else {
      const platform = os.platform();
      switch (platform) {
        case 'darwin':
          switch (this.#product) {
            case 'chrome':
              this.#platform =
                os.arch() === 'arm64' && PUPPETEER_EXPERIMENTAL_CHROMIUM_MAC_ARM
                  ? 'mac_arm'
                  : 'mac';
              break;
            case 'firefox':
              this.#platform = 'mac';
              break;
          }
          break;
        case 'linux':
          this.#platform = 'linux';
          break;
        case 'win32':
          this.#platform = os.arch() === 'x64' ? 'win64' : 'win32';
          return;
        default:
          assert(false, 'Unsupported platform: ' + platform);
      }
    }

    assert(
      downloadURLs[this.#product][this.#platform],
      'Unsupported platform: ' + this.#platform
    );
  }

  /**
   * @returns Returns the current `Platform`, which is one of `mac`, `linux`,
   * `win32` or `win64`.
   */
  platform(): Platform {
    return this.#platform;
  }

  /**
   * @returns Returns the current `Product`, which is one of `chrome` or
   * `firefox`.
   */
  product(): Product {
    return this.#product;
  }

  /**
   * @returns The download host being used.
   */
  host(): string {
    return this.#downloadHost;
  }

  /**
   * Initiates a HEAD request to check if the revision is available.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to check availability for.
   * @returns A promise that resolves to `true` if the revision could be downloaded
   * from the host.
   */
  canDownload(revision: string): Promise<boolean> {
    const url = downloadURL(
      this.#product,
      this.#platform,
      this.#downloadHost,
      revision
    );
    return new Promise(resolve => {
      const request = httpRequest(
        url,
        'HEAD',
        response => {
          resolve(response.statusCode === 200);
        },
        false
      );
      request.on('error', error => {
        console.error(error);
        resolve(false);
      });
    });
  }

  /**
   * Initiates a GET request to download the revision from the host.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to download.
   * @param progressCallback - A function that will be called with two arguments:
   * How many bytes have been downloaded and the total number of bytes of the download.
   * @returns A promise with revision information when the revision is downloaded
   * and extracted.
   */
  async download(
    revision: string,
    progressCallback: (x: number, y: number) => void = (): void => {}
  ): Promise<BrowserFetcherRevisionInfo | undefined> {
    const url = downloadURL(
      this.#product,
      this.#platform,
      this.#downloadHost,
      revision
    );
    const fileName = url.split('/').pop();
    assert(fileName, `A malformed download URL was found: ${url}.`);
    const archivePath = path.join(this.#downloadsFolder, fileName);
    const outputPath = this.#getFolderPath(revision);
    if (await existsAsync(outputPath)) {
      return this.revisionInfo(revision);
    }
    if (!(await existsAsync(this.#downloadsFolder))) {
      await mkdirAsync(this.#downloadsFolder);
    }

    // Use system Chromium builds on Linux ARM devices
    if (os.platform() !== 'darwin' && os.arch() === 'arm64') {
      handleArm64();
      return;
    }
    try {
      await _downloadFile(url, archivePath, progressCallback);
      await install(archivePath, outputPath);
    } finally {
      if (await existsAsync(archivePath)) {
        await unlinkAsync(archivePath);
      }
    }
    const revisionInfo = this.revisionInfo(revision);
    if (revisionInfo) {
      await chmodAsync(revisionInfo.executablePath, 0o755);
    }
    return revisionInfo;
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @returns A promise with a list of all revision strings (for the current `product`)
   * available locally on disk.
   */
  async localRevisions(): Promise<string[]> {
    if (!(await existsAsync(this.#downloadsFolder))) {
      return [];
    }
    const fileNames = await readdirAsync(this.#downloadsFolder);
    return fileNames
      .map(fileName => {
        return parseFolderPath(this.#product, fileName);
      })
      .filter(
        (
          entry
        ): entry is {product: string; platform: string; revision: string} => {
          return (entry && entry.platform === this.#platform) ?? false;
        }
      )
      .map(entry => {
        return entry.revision;
      });
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - A revision to remove for the current `product`.
   * @returns A promise that resolves when the revision has been removes or
   * throws if the revision has not been downloaded.
   */
  async remove(revision: string): Promise<void> {
    const folderPath = this.#getFolderPath(revision);
    assert(
      await existsAsync(folderPath),
      `Failed to remove: revision ${revision} is not downloaded`
    );
    await Deno.remove(folderPath, { recursive: true });
  }

  /**
   * @param revision - The revision to get info for.
   * @returns The revision info for the given revision.
   */
  revisionInfo(revision: string): BrowserFetcherRevisionInfo {
    const folderPath = this.#getFolderPath(revision);
    let executablePath = '';
    if (this.#product === 'chrome') {
      if (this.#platform === 'mac' || this.#platform === 'mac_arm') {
        executablePath = path.join(
          folderPath,
          archiveName(this.#product, this.#platform, revision),
          'Chromium.app',
          'Contents',
          'MacOS',
          'Chromium'
        );
      } else if (this.#platform === 'linux') {
        executablePath = path.join(
          folderPath,
          archiveName(this.#product, this.#platform, revision),
          'chrome'
        );
      } else if (this.#platform === 'win32' || this.#platform === 'win64') {
        executablePath = path.join(
          folderPath,
          archiveName(this.#product, this.#platform, revision),
          'chrome.exe'
        );
      } else {
        throw new Error('Unsupported platform: ' + this.#platform);
      }
    } else if (this.#product === 'firefox') {
      if (this.#platform === 'mac' || this.#platform === 'mac_arm') {
        executablePath = path.join(
          folderPath,
          'Firefox Nightly.app',
          'Contents',
          'MacOS',
          'firefox'
        );
      } else if (this.#platform === 'linux') {
        executablePath = path.join(folderPath, 'firefox', 'firefox');
      } else if (this.#platform === 'win32' || this.#platform === 'win64') {
        executablePath = path.join(folderPath, 'firefox', 'firefox.exe');
      } else {
        throw new Error('Unsupported platform: ' + this.#platform);
      }
    } else {
      throw new Error('Unsupported product: ' + this.#product);
    }
    const url = downloadURL(
      this.#product,
      this.#platform,
      this.#downloadHost,
      revision
    );
    const local = fs.existsSync(folderPath);
    debugFetcher({
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this.#product,
    });
    return {
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this.#product,
    };
  }

  #getFolderPath(revision: string): string {
    return path.resolve(this.#downloadsFolder, `${this.#platform}-${revision}`);
  }
}

function parseFolderPath(
  product: Product,
  folderPath: string
): {product: string; platform: string; revision: string} | undefined {
  const name = path.basename(folderPath);
  const splits = name.split('-');
  if (splits.length !== 2) {
    return;
  }
  const [platform, revision] = splits;
  if (!revision || !platform || !(platform in downloadURLs[product])) {
    return;
  }
  return {product, platform, revision};
}

/**
 * @internal
 */
async function _downloadFile(
  url: string,
  destinationPath: string,
  progressCallback?: (x: number, y: number) => void
): Promise<void> {
  debugFetcher(`Downloading binary from ${url}`);

  const response = await fetch(url, { method: "GET" });

  if (response.status !== 200) {
    const error = new Error(
      `Download failed: server returned code ${response.status}. URL: ${url}`,
    );

    // consume response data to free up memory
    await response.arrayBuffer();
    throw error;
  }

  let downloadedBytes = 0;
  const totalBytes = parseInt(response.headers.get("content-length") ?? "", 10);

  const file = await Deno.create(destinationPath);

  for await (const chunk of response.body!) {
    downloadedBytes += chunk.length;
    progressCallback?.(downloadedBytes, totalBytes);
    await writeAll(file, chunk);
  }

  Deno.close(file.rid);

}

function install(archivePath: string, folderPath: string): Promise<unknown> {
  debugFetcher(`Installing ${archivePath} to ${folderPath}`);
  if (archivePath.endsWith('.zip')) {
    return extractZip(archivePath, {dir: folderPath});
  } else if (archivePath.endsWith('.tar.bz2')) {
    return _extractTar(archivePath, folderPath);
  } else if (archivePath.endsWith('.dmg')) {
    return mkdirAsync(folderPath).then(() => {
      return _installDMG(archivePath, folderPath);
    });
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}

/**
 * @internal
 */
async function _extractTar(tarPath: string, folderPath: string): Promise<unknown> {
  await Deno.mkdir(folderPath, { recursive: true });

  const bzcat = Deno.run({
    cmd: ["bzcat", tarPath],
    stdout: "piped",
  });
  const tmp = await Deno.makeTempFile();
  const file = await Deno.create(tmp);
  await copyIO(bzcat.stdout, file);
  assert((await bzcat.status()).success, "failed bzcat");
  bzcat.close();

  const untar = Deno.run({
    cmd: ["tar", "-C", folderPath, "-xvf", tmp],
  });
  assert((await untar.status()).success, "failed untar");
  untar.close();
}

/**
 * @internal
 */
function _installDMG(dmgPath: string, folderPath: string): Promise<void> {
  let mountPath: string | undefined;

  async function mountAndCopy() {
    const proc = Deno.run({
      cmd: ["hdiutil", "attach", "-nobrowse", "-noautoopen", dmgPath],
    });
    const stdout = new TextDecoder().decode(await proc.output());
    proc.close();
    const volumes = stdout.match(/\/Volumes\/(.*)/m);
    if (!volumes) {
      throw new Error(`Could not find volume path in ${stdout}`);
    }
    mountPath = volumes[0];

    let appName = undefined;
    for await (const file of Deno.readDir(mountPath)) {
      if (file.name.endsWith(".app")) {
        appName = file.name;
        break;
      }
    }
    if (!appName) throw new Error(`Cannot find app in ${mountPath}`);
    await copy(path.join(mountPath, appName), folderPath);
  }

  async function unmount() {
    if (!mountPath) return;
    const proc = Deno.run({
      cmd: ["hdiutil", "detach", mountPath, "-quiet"],
    });
    debugFetcher(`Unmounting ${mountPath}`);
    const status = await proc.status();
    proc.close();
    assert(status.success, `Error unmounting dmg: ${mountPath}`);
  }

  return mountAndCopy()
    .catch((error) => {
      console.error(error);
    })
    .finally(unmount);
}
