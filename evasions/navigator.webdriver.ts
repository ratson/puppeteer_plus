import type { Page } from "../mod.ts";

export const args = ["--disable-blink-features=AutomationControlled"];

export async function deleteNavigatorWebdriverProperty(page: Page) {
  await page.evaluateOnNewDocument(() => {
    // @ts-expect-error non-standard
    const { webdriver } = navigator;
    if (webdriver === false) {
      // Post Chrome 89.0.4339.0 and already good
    } else if (webdriver === undefined) {
      // Pre Chrome 89.0.4339.0 and already good
    } else {
      // Pre Chrome 88.0.4291.0 and needs patching
      delete Object.getPrototypeOf(navigator).webdriver;
    }
  });
}
