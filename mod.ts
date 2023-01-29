import "./src/patch.ts"
import { downloadBrowser } from 'npm:puppeteer/internal/node/install.js';

export * from "npm:puppeteer";
export { default } from "npm:puppeteer";


downloadBrowser();
