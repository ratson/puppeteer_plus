import { BrowserWebSocketTransport } from "npm:puppeteer-core/internal/common/BrowserWebSocketTransport.js";
import { NodeWebSocketTransport } from "npm:puppeteer-core/internal/common/NodeWebSocketTransport.js";
import { importFSPromises } from "npm:puppeteer-core/internal/common/util.js";

// @ts-expect-error patch
NodeWebSocketTransport.create = BrowserWebSocketTransport.create;

try {
  const fs = await importFSPromises();
  const _open = fs.promises.open;
  fs.promises.open = async (...args: Parameters<typeof _open>) => {
    const f = await _open(...args);
    if (typeof f === "number" && args.length === 2 && args[1] === "w+") {
      return {
        writeFile(s: string) {
          return fs.promises.writeFile(f, s);
        },
        async close() {
          return await new Promise((resolve) =>
            fs.close(f, () => resolve(undefined))
          );
        },
      };
    }
    return f;
  };
} catch {
  // ignore error
}
