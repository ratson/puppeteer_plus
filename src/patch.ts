import { Browser, Page } from "npm:puppeteer-core@22.6.1";
import { importFSPromises } from "npm:puppeteer-core@22.6.1/internal/common/util.js";

try {
  const fs = await importFSPromises();
  const fileHandle = await fs.open(Deno.execPath());
  if (typeof fileHandle.writeFile === "undefined") {
    Object.getPrototypeOf(fileHandle).writeFile = function (s: string) {
      return fs.writeFile(this.rid, s);
    };
  }
  await fileHandle.close();
} catch (err) {
  console.error(err);
}

declare module "npm:puppeteer-core@22.6.1" {
  interface Browser {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
  interface Page {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
}

if (!(Symbol.asyncDispose in Browser)) {
  Browser.prototype[Symbol.asyncDispose] = async function () {
    await this.close();
  };
  Page.prototype[Symbol.asyncDispose] = async function () {
    await this.close();
  };
}
