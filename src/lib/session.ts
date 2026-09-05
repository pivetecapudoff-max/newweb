const KEY = "farol.session";

export interface Session {
  name: string;
  enteredAt: string;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(name: string): Session {
  const session = { name: name.trim(), enteredAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
