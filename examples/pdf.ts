import puppeteer from "../mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://news.ycombinator.com", {
  waitUntil: "networkidle2",
});

const tempFilePath = await Deno.makeTempFile({ suffix: ".pdf" });
await page.pdf({ path: tempFilePath, format: "a4" });

await browser.close();

console.log(tempFilePath);
