import puppeteer from "../mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://www.wikipedia.org");
await page.screenshot({ path: "example.png" });

await browser.close();
