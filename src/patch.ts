import { BrowserWebSocketTransport } from "npm:puppeteer-core/internal/common/BrowserWebSocketTransport.js"
import { NodeWebSocketTransport } from "npm:puppeteer-core/internal/common/NodeWebSocketTransport.js"

// @ts-expect-error patch
NodeWebSocketTransport.create = BrowserWebSocketTransport.create
