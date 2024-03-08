import {
  Browser,
  default as puppeteer,
  PuppeteerNodeLaunchOptions,
} from "./mod.ts";
import { delay } from "https://deno.land/std@0.219.1/async/delay.ts";

export {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertMatch,
  assertStrictEquals,
} from "https://deno.land/std@0.219.1/assert/mod.ts";

export function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
  {
    launch,
    ...opts
  }:
    & { launch?: PuppeteerNodeLaunchOptions }
    & Omit<
      Deno.TestDefinition,
      "name" | "fn"
    > = {},
) {
  Deno.test(
    name,
    {
      sanitizeOps: false,
      sanitizeResources: false,
      ...opts,
    },
    async () => {
      {
        await using browser = await puppeteer.launch(launch);
        await fn(browser);
      }
      // TODO ensure close() not leak async ops
      await delay(500);
    },
  );
}
