import "./core.ts";
import "./src/install.ts";

declare module "npm:puppeteer@22.4.1" {
  interface Browser {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
  interface Page {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
}

export * from "npm:puppeteer@22.4.1";
export { default } from "npm:puppeteer@22.4.1";
