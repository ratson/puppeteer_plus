import { initializePuppeteerDeno } from "./src/initialize-deno.ts";
import { downloadBrowser } from "./src/install.ts";

export * from "./src/mod.ts";

export const puppeteer = await initializePuppeteerDeno("puppeteer");
export default puppeteer;

if (!Deno.env.get("PUPPETEER_EXECUTABLE_PATH")) {
  await downloadBrowser(puppeteer);
}
