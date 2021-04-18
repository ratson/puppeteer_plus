import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";
import { Browser, puppeteer } from "./mod.ts";

function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
) {
  Deno.test(name, async () => {
    let browser: Browser | undefined = undefined;
    try {
      browser = await puppeteer.launch({});
      await fn(browser!);
    } finally {
      if (browser) await browser.close();
    }
  });
}

browserTest("puppeteer", async (browser) => {
  const page = await browser.newPage();
  await page.goto("https://deno.land", { waitUntil: "domcontentloaded" });
  const h1 = await page.$("h1");
  assert(h1);
  // deno-lint-ignore no-explicit-any
  assertEquals(await h1.evaluate((e: any) => e.innerText), "Deno");
});
