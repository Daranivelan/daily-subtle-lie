import type { RevealPayload } from "@/types";

function saltBytes(key: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < key.length; i++) {
    bytes.push(key.charCodeAt(i) ^ (0x5a + (i % 7)));
  }
  while (bytes.length < 32) {
    bytes.push(bytes[bytes.length % Math.max(key.length, 1)]! ^ bytes.length);
  }
  return bytes;
}

function xorBytes(data: Uint8Array, key: number[]): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i]! ^ key[i % key.length]!;
  }
  return out;
}

/** Prefer btoa/atob everywhere so server + client stay in sync. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(token: string): Uint8Array {
  const padded = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;

  const binary =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Light obfuscation of reveal payload. `key` is puzzle id or date. */
export function obfuscateReveal(
  key: string,
  lieIndex: number,
  truth: string,
): string {
  const payload: RevealPayload = {
    lie_index: Number(lieIndex),
    truth,
  };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64Url(xorBytes(encoded, saltBytes(key)));
}

export function deobfuscateReveal(
  key: string,
  token: string,
): RevealPayload | null {
  if (!key || !token) return null;
  try {
    const decoded = xorBytes(base64UrlToBytes(token), saltBytes(key));
    const json = new TextDecoder().decode(decoded);
    const parsed = JSON.parse(json) as RevealPayload;
    const lieIndex = Number(parsed.lie_index);
    if (!Number.isFinite(lieIndex) || typeof parsed.truth !== "string") {
      return null;
    }
    return { lie_index: lieIndex, truth: parsed.truth };
  } catch {
    return null;
  }
}
