import { importFSPromises } from "npm:puppeteer-core@21.6.0/internal/common/util.js";

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
