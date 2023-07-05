import {
  Browser,
  default as puppeteer,
  PuppeteerNodeLaunchOptions,
} from "./mod.ts";
import { delay } from "https://deno.land/std@0.193.0/async/delay.ts";

export {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertMatch,
  assertStrictEquals,
} from "https://deno.land/std@0.193.0/testing/asserts.ts";

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
