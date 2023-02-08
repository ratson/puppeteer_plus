import { addExtra } from "npm:puppeteer-extra";
import "npm:puppeteer-extra-plugin-user-preferences"
import plugin from "npm:puppeteer-extra-plugin-font-size";
import vanillaPuppeteer from "../mod.ts";

const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(plugin({ defaultFontSize: 36 }));

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://www.wikipedia.org", { waitUntil: "domcontentloaded" });

const tempFilePath = await Deno.makeTempFile({ suffix: ".png" });
await page.screenshot({ path: tempFilePath });

await browser.close();

console.log(tempFilePath);
