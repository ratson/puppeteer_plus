import { Browser, puppeteer, PuppeteerNodeLaunchOptions } from "./mod.ts";
import { delay } from "https://deno.land/std@0.151.0/async/delay.ts";

export {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.151.0/testing/asserts.ts";

export * as subprocess from "https://deno.land/x/yxz@0.17.0/subprocess/mod.ts";

export function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
  { launch, ...opts }:
    & { launch?: PuppeteerNodeLaunchOptions }
    & Omit<Deno.TestDefinition, "name" | "fn"> = {},
) {
  Deno.test(name, opts, async () => {
    let browser: Browser | undefined = undefined;
    try {
      browser = await puppeteer.launch(launch);
      await fn(browser);
    } finally {
      await browser?.close();
    }
    // TODO ensure close() not leak async ops
    await delay(500);
  });
}
