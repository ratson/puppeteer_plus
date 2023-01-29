import { downloadBrowser } from 'npm:puppeteer/internal/node/install.js';
import { initializePuppeteerDeno } from "./src/initialize-deno.ts";

export * from "./src/mod.ts";

export const puppeteer = await initializePuppeteerDeno("puppeteer");
export default puppeteer;


downloadBrowser();
