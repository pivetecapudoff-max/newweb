export interface TurnstileConfig {
  enabled: boolean;
  siteKey: string;
}

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey =
    process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || "0x4AAAAAAEpxfi6uszCtFkZQ";
  return {
    enabled: true,
    siteKey,
  };
}

export async function verifyTurnstile(
  token?: string,
  ip?: string
): Promise<{ success: boolean; error?: string }> {
  // If explicitly disabled via environment variable
  if (process.env.CLOUDFLARE_TURNSTILE_ENABLED === "false") {
    return { success: true };
  }

  const secret =
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    "0x4AAAAAAEpxftfU4Sdb38TF5cY_mk_GMoA";

  if (!token) {
    return {
      success: false,
      error: "Por favor, complete a verificação de segurança da Cloudflare.",
    };
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: ip || undefined,
        }),
      }
    );

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      const errCodes = (data["error-codes"] || []).join(", ");
      return {
        success: false,
        error: `Verificação Cloudflare falhou (${errCodes || "token inválido"}). Tente novamente.`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Cloudflare Turnstile verification error:", err);
    // In case of network timeout with Cloudflare API, allow fail-open or fail-closed based on config
    return {
      success: false,
      error: "Não foi possível validar com os servidores da Cloudflare. Tente novamente.",
    };
  }
}
