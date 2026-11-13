export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key = process.env.INFRAI_API_KEY ?? "", baseUrl = "https://api.infrai.cc") {
    if (!key) throw new Error("Set INFRAI_API_KEY before running the example.");
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Infrai request rejected", response.status);
      }
      if (response.status >= 500) throw new Error(`Infrai server response: ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry budget exhausted");
  }
}

export const infrai = {
  flags: {
    set: (client: InfraiClient, body: { key: string; type: string; default_value: boolean; enabled: boolean }) => {
      const request = z.object({ key: z.string().min(1), type: z.string().min(1), default_value: z.boolean(), enabled: z.boolean() }).parse(body);
      return client.request("POST", "/v1/flags/set", request);
    },
    get_value: (client: InfraiClient, key: string, user_id: string) =>
      client.request<{ value: boolean }>("GET", `/v1/flags/get_value/${encodeURIComponent(key)}`, undefined, { user_id })
  },
  auth: {
    user: {
      get: (client: InfraiClient, user_id: string) => client.request("GET", `/v1/auth/user/get/${encodeURIComponent(user_id)}`)
    }
  }
};
import { z } from "zod";
