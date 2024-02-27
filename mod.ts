import "./core.ts";
import "./src/install.ts";

declare module "npm:puppeteer@22.3.0" {
  interface Browser {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
  interface Page {
    [Symbol.asyncDispose]: () => Promise<void>;
  }
}

export * from "npm:puppeteer@22.3.0";
export { default } from "npm:puppeteer@22.3.0";
