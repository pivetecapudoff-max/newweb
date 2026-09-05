import { loadState } from "./store.js";

const WEBHOOK_RE = /^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i;
const SECRET = /cookie|roblosecurity|token|password|webhook|\.ROBLOSECURITY|data:image/i;

export function isDiscordWebhook(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

function webhookUrl(): string | null {
  const url = String(loadState().settings.discordWebhook || "").trim();
  return isDiscordWebhook(url) ? url : null;
}

function clean(text: string, max: number): string {
  if (SECRET.test(text)) return "[redacted]";
  return text.slice(0, max);
}

const lastSent = new Map<string, number>();

export function debounceKey(key: string, ms: number): boolean {
  const now = Date.now();
  const prev = lastSent.get(key) || 0;
  if (now - prev < ms) return false;
  lastSent.set(key, now);
  return true;
}

export async function notifyDiscord(input: {
  title: string;
  body: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: number;
}): Promise<void> {
  const url = webhookUrl();
  if (!url) return;
  const fields = (input.fields || [])
    .filter((field) => !SECRET.test(field.name + field.value))
    .slice(0, 25)
    .map((field) => ({
      name: clean(field.name, 80),
      value: clean(String(field.value), 1024) || "—",
      inline: Boolean(field.inline),
    }));
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Illusions UGC Bot",
        embeds: [
          {
            title: clean(input.title, 120),
            description: clean(input.body, 4000),
            color: input.color ?? 0x2b2b2b,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Discord down should not break the desk
  }
}

export async function pingDiscordWebhook(url: string): Promise<void> {
  if (!isDiscordWebhook(url)) {
    throw new Error("That is not a Discord webhook URL.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Illusions UGC Bot",
      embeds: [
        {
          title: "Webhook connected",
          description:
            "Full desk log is on. Scans, searches, uploads, dashboard, settings, downloads. Cookies and images are never sent.",
          color: 0xd8d8d8,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Discord rejected the webhook (${res.status}).`);
  }
}
