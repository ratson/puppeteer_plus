import { Browser, puppeteer, PuppeteerNodeLaunchOptions } from "./mod.ts";

export {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.115.1/testing/asserts.ts";

export function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
  opts?: { launch?: PuppeteerNodeLaunchOptions },
) {
  Deno.test(name, async () => {
    let browser: Browser | undefined = undefined;
    try {
      browser = await puppeteer.launch(opts?.launch);
      await fn(browser);
    } finally {
      await browser?.close();
    }
  });
}
