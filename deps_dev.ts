import { Browser, puppeteer, PuppeteerNodeLaunchOptions } from "./mod.ts";

export {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.122.0/testing/asserts.ts";

export * as subprocess from "https://deno.land/x/yxz@0.14.0/subprocess/mod.ts"

export function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
  { launch, ...opts }:
    & { launch?: PuppeteerNodeLaunchOptions }
    & Omit<Deno.TestDefinition, "name" | "fn"> = {},
) {
  Deno.test({
    name,
    async fn() {
      let browser: Browser | undefined = undefined;
      try {
        browser = await puppeteer.launch(launch);
        await fn(browser);
      } finally {
        await browser?.close();
      }
    },
    ...opts,
  });
}
