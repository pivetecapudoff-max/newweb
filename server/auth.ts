import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadAccountForDiscordUser } from "./account.js";
import { cloudConfigured, fetchCloudAccount, touchDiscordProfile } from "./cloud.js";
import { runAuthStore, type DiscordIdentity } from "./context.js";
import { isSecureRequest, requestOrigin } from "./host.js";

const SESSION_COOKIE = "illusions_session";
const STATE_COOKIE = "illusions_oauth";
const runtimeSessionSecret = randomBytes(32).toString("hex");

function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || runtimeSessionSecret;
}

export function readCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function cookieBase(req: Request | undefined, maxAge: number): string {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isSecureRequest(req) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function setCookie(res: Response, name: string, value: string, maxAge: number, req?: Request): void {
  const line = `${name}=${encodeURIComponent(value)}; ${cookieBase(req, maxAge)}`;
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", line);
    return;
  }
  const list = Array.isArray(prev) ? prev : [String(prev)];
  res.setHeader("Set-Cookie", [...list, line]);
}

function clearCookie(res: Response, name: string, req?: Request): void {
  setCookie(res, name, "", 0, req);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function writeSession(res: Response, discord: DiscordIdentity, req?: Request): void {
  const payload = Buffer.from(
    JSON.stringify({
      id: discord.id,
      name: discord.name,
      avatar: discord.avatar,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
    "utf8"
  ).toString("base64url");
  setCookie(res, SESSION_COOKIE, `${payload}.${sign(payload)}`, 30 * 24 * 60 * 60, req);
}

function readSession(req: Request): DiscordIdentity | null {
  const raw = readCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payload);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: string;
      name?: string;
      avatar?: string | null;
      exp?: number;
    };
    if (!data.id || data.id === "103546492591035464" || !data.exp || data.exp < Date.now()) return null;
    return {
      id: data.id,
      name: data.name || "discord",
      avatar: data.avatar || null,
    };
  } catch {
    return null;
  }
}

export function isCloudAuth(): boolean {
  return discordConfigured();
}

export function authStatus(req: Request) {
  return {
    discordEnabled: discordConfigured(),
    discord: readSession(req),
  };
}

export async function authContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const discord = readSession(req);
    if (!discord) {
      runAuthStore({ discord: null, account: null }, () => next());
      return;
    }
    if (cloudConfigured()) {
      const account = await fetchCloudAccount(discord.id);
      runAuthStore({ discord, account }, () => next());
      return;
    }
    const account = loadAccountForDiscordUser(discord.id);
    runAuthStore({ discord, account }, () => next());
  } catch (error) {
    next(error);
  }
}

export function startDiscordLogin(req: Request, res: Response): void {
  const origin = requestOrigin(req);
  if (!discordConfigured()) {
    res.redirect(`${origin}/painel/conta?discord=not-configured`);
    return;
  }
  const cookies = readCookies(req);
  if (process.env.CLOUDFLARE_TURNSTILE_ENABLED !== "false" && isHosted(req)) {
    if (cookies["illusions_cf_verified"] !== "true") {
      res.redirect(`${origin}/login?error=turnstile_required`);
      return;
    }
  }
  const state = randomBytes(16).toString("hex");
  setCookie(res, STATE_COOKIE, state, 600, req);
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  url.searchParams.set("response_type", "code");
  const scopes = (process.env.DISCORD_OAUTH_SCOPES || "identify guilds gdm.join guilds.join").trim();
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
}

export async function finishDiscordLogin(req: Request, res: Response): Promise<void> {
  const origin = requestOrigin(req);
  const fallback = `${origin}/login`;
  if (!isCloudAuth()) {
    res.redirect(fallback);
    return;
  }
  const cookies = readCookies(req);
  const expectedState = cookies[STATE_COOKIE];
  const state = String(req.query.state || "");
  const code = String(req.query.code || "");
  clearCookie(res, STATE_COOKIE, req);
  if (!code) {
    console.warn("[OAuth] Discord denied or missing code.");
    res.redirect(`${fallback}?error=discord_denied`);
    return;
  }
  if (expectedState && state && expectedState !== state) {
    console.warn(`[OAuth] State mismatch warning (expected: ${expectedState}, received: ${state})`);
  }
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[OAuth] Token exchange failed HTTP ${tokenRes.status}:`, errBody);
      throw new Error(`Discord token exchange failed: ${errBody}`);
    }
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Discord did not return a token.");
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) {
      const errBody = await meRes.text();
      console.error(`[OAuth] Fetch user failed HTTP ${meRes.status}:`, errBody);
      throw new Error(`Discord user fetch failed: ${errBody}`);
    }
    const me = (await meRes.json()) as {
      id?: string;
      username?: string;
      global_name?: string;
      avatar?: string | null;
    };
    if (!me.id) throw new Error("Discord did not return a user id.");
    const discord: DiscordIdentity = {
      id: me.id,
      name: me.global_name || me.username || "discord",
      avatar: me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png`
        : null,
    };
    writeSession(res, discord, req);
    if (cloudConfigured()) {
      try {
        await touchDiscordProfile(discord);
      } catch (err) {
        console.error("Supabase profile sync error:", err);
      }
    }
    console.log(`[OAuth] Discord user logged in successfully: @${discord.name} (${discord.id})`);

    // Auto-join member to Discord server via guilds.join scope
    const targetGuildId = process.env.DISCORD_GUILD_ID || "1458096843526377565";
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (targetGuildId && botToken && token.access_token && me.id) {
      try {
        const joinPayload: Record<string, any> = {
          access_token: token.access_token,
        };
        if (process.env.DISCORD_JOIN_ROLE_ID) {
          joinPayload.roles = [process.env.DISCORD_JOIN_ROLE_ID];
        }

        const joinRes = await fetch(
          `https://discord.com/api/v10/guilds/${targetGuildId}/members/${me.id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(joinPayload),
          }
        );

        if (joinRes.status === 201) {
          console.log(
            `[OAuth Guild Join] Sucesso: Usuário @${discord.name} (${me.id}) adicionado ao servidor ${targetGuildId}!`
          );
        } else if (joinRes.status === 204) {
          console.log(
            `[OAuth Guild Join] Usuário @${discord.name} (${me.id}) já é membro do servidor ${targetGuildId}.`
          );
        } else {
          const joinErrBody = await joinRes.text();
          console.warn(
            `[OAuth Guild Join] Resposta do Discord ao adicionar @${discord.name} (HTTP ${joinRes.status}):`,
            joinErrBody
          );
        }
      } catch (joinErr: any) {
        console.error(
          "[OAuth Guild Join] Erro ao adicionar membro ao servidor:",
          joinErr?.message || joinErr
        );
      }
    } else if (!botToken) {
      console.warn(
        "[OAuth Guild Join] DISCORD_BOT_TOKEN não configurado. Adicione DISCORD_BOT_TOKEN no Render para puxar os usuários automaticamente para o servidor."
      );
    }

    res.redirect(`${origin}/painel/dashboard`);
  } catch (err) {
    console.error("[OAuth] finishDiscordLogin error:", err);
    res.redirect(`${fallback}?error=auth_error`);
  }
}

export function logoutSession(req: Request, res: Response): void {
  clearCookie(res, SESSION_COOKIE, req);
  clearCookie(res, STATE_COOKIE, req);
  res.json({ ok: true, connected: false, discordEnabled: isCloudAuth(), discord: null });
}
