import { getConfiguration } from "npm:puppeteer/internal/getConfiguration.js";
import { downloadBrowser } from "npm:puppeteer/internal/node/install.js";

const configuration = getConfiguration();
if (typeof configuration.downloadBaseUrl === "undefined") {
  Deno.env.set(
    "PUPPETEER_DOWNLOAD_BASE_URL",
    "http://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing",
  );
}

await downloadBrowser();
