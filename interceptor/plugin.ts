import type { Browser, Page } from "npm:puppeteer";
import { PuppeteerExtraPlugin } from "npm:puppeteer-extra-plugin";
import { intercept, type Interceptor } from "./mod.ts";
import type { Protocol } from "./deps.ts";

declare module "npm:puppeteer" {
    export interface Page {
        intercept(
            patterns: Protocol.Fetch.RequestPattern[],
            eventHandlers: Interceptor.EventHandlers,
        ): void;
    }
}

class InterceptorPlugin extends PuppeteerExtraPlugin {
    constructor(opts = {}) {
        super(opts);
        this.debug("interceptor initialized");
    }

    async onBrowser(browser: Browser) {
        const initPages = await browser.pages();
        for (const page of initPages) {
            this.#intercept(page);
        }
    }

    async onPageCreated(page: Page) {
        await this.#intercept(page);
    }

    #intercept(page: Page) {
        if (!page.intercept) {
            Object.assign(page, {
                intercept(requestPatterns: Protocol.Fetch.RequestPattern[], handlers: Interceptor.EventHandlers) {
                    intercept(this as never, requestPatterns, handlers);
                },
            });
        }
    }

    get name() {
        return "puppeteer-extra-plugin-interceptor";
    }
}

export function interceptor(pluginConfig = {}) {
    return new InterceptorPlugin(pluginConfig);
}
