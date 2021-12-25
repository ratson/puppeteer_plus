import { Protocol } from "./deps.ts";

export type PatternGenerator = {
  [key in Protocol.Network.ResourceType | "All"]: (
    patterns: string | string[],
  ) => Protocol.Fetch.RequestPattern[];
};

export const patterns: PatternGenerator = {
  CSPViolationReport: patternGenerator("CSPViolationReport"),
  Document: patternGenerator("Document"),
  EventSource: patternGenerator("EventSource"),
  Fetch: patternGenerator("Fetch"),
  Font: patternGenerator("Font"),
  Image: patternGenerator("Image"),
  Manifest: patternGenerator("Manifest"),
  Media: patternGenerator("Media"),
  Other: patternGenerator("Other"),
  Ping: patternGenerator("Ping"),
  Preflight: patternGenerator("Preflight"),
  Script: patternGenerator("Script"),
  SignedExchange: patternGenerator("SignedExchange"),
  Stylesheet: patternGenerator("Stylesheet"),
  TextTrack: patternGenerator("TextTrack"),
  WebSocket: patternGenerator("WebSocket"),
  XHR: patternGenerator("XHR"),
  All: (patterns: string | string[]) =>
    toArray(patterns).map((pattern) => ({
      urlPattern: pattern,
      requestStage: "Response",
    })),
};

function patternGenerator(type: string) {
  return (patterns: string | string[]) =>
    toArray(patterns).map(toPattern(type));
}

function toArray(o: string | string[]) {
  return Array.isArray(o) ? o : [o];
}

function toPattern(type: string) {
  return (urlPattern: string) => ({
    urlPattern,
    resourceType: type,
    requestStage: "Response",
  } as Protocol.Fetch.RequestPattern);
}
