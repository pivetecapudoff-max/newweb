import type { Request } from "express";

function isLoopback(value: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(value);
}

export function requestOrigin(req?: Request): string {
  const fromEnv = String(process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (!req) return "http://127.0.0.1:5174";
  const proto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim() || req.protocol || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return "http://127.0.0.1:5174";
}

export function isHosted(req?: Request): boolean {
  if (process.env.PORT) return true;
  const origin = requestOrigin(req);
  return Boolean(origin && !isLoopback(origin));
}

export function isSecureRequest(req?: Request): boolean {
  if (req) {
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    if (proto === "https" || req.secure) return true;
  }
  return requestOrigin(req).startsWith("https://");
}

export function listenTarget(): { port: number; host: string; hosted: boolean } {
  const hosted = Boolean(process.env.PORT) || isHosted();
  return {
    port: Number(process.env.PORT || process.env.FAROL_PORT || 8788),
    host: process.env.FAROL_HOST || "0.0.0.0",
    hosted,
  };
}
