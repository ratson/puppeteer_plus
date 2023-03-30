import { BrowserWebSocketTransport } from "npm:puppeteer-core/internal/common/BrowserWebSocketTransport.js";
import { NodeWebSocketTransport } from "npm:puppeteer-core/internal/common/NodeWebSocketTransport.js";
import { importFSPromises } from "npm:puppeteer-core/internal/common/util.js";

Object.assign(NodeWebSocketTransport, {
  create: BrowserWebSocketTransport.create,
});

try {
  const fs = await importFSPromises();
  const _open = fs.open;
  Object.defineProperty(fs, "open", {
    async value(...args: Parameters<typeof _open>) {
      const f = await _open(...args);
      if (typeof f === "number" && args.length === 2 && args[1] === "w+") {
        return {
          writeFile(s: string) {
            return fs.writeFile(f, s);
          },
          close() {
            return new Promise((resolve) =>
              // @ts-ignore patch
              fs.close(f, () => resolve(undefined))
            );
          },
        };
      }
      return f;
    },
  });
} catch (_err) {
  // ignore error
}
