import { BrowserWebSocketTransport } from "npm:puppeteer-core/internal/common/BrowserWebSocketTransport.js";
import { NodeWebSocketTransport } from "npm:puppeteer-core/internal/common/NodeWebSocketTransport.js";
import { importFSPromises } from "npm:puppeteer-core/internal/common/util.js";

Object.assign(NodeWebSocketTransport, {
  create: BrowserWebSocketTransport.create,
});

try {
  const fs = await importFSPromises();
  const fileHandle = await fs.open(await Deno.makeTempFile(), "r+");
  if (typeof fileHandle.writeFile === "undefined") {
    Object.getPrototypeOf(fileHandle).writeFile = function (s: string) {
      return fs.writeFile(this.rid, s);
    };
  }
} catch (_err) {
  // ignore error
}
