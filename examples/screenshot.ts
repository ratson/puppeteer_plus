import puppeteer from "../mod.ts";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.goto("https://www.wikipedia.org");

const tempFilePath = await Deno.makeTempFile({ suffix: ".png" });
await page.screenshot({ path: tempFilePath });

await browser.close();

console.log(tempFilePath);
