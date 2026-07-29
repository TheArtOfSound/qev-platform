export function b64urlEncode(bytes: Uint8Array): string {
  const g = globalThis as unknown as {
    Buffer?: { from(data: Uint8Array): { toString(enc: string): string } };
    btoa?: (s: string) => string;
  };
  if (g.Buffer) {
    return g.Buffer.from(bytes)
      .toString("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  if (!g.btoa) throw new Error("No base64 encoder available");
  return g
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function b64urlDecode(str: string): Uint8Array {
  if (typeof str !== "string") throw new TypeError("b64urlDecode expects string");
  if (!/^[A-Za-z0-9_-]*=*$/.test(str)) {
    throw new Error("b64urlDecode: invalid character");
  }
  const b64 = str.replaceAll("-", "+").replaceAll("_", "/");
  const pad = b64.length % 4;
  const padded = pad === 0 ? b64 : b64 + "=".repeat(4 - pad);
  const g = globalThis as unknown as {
    Buffer?: { from(data: string, enc: string): Uint8Array };
    atob?: (s: string) => string;
  };
  if (g.Buffer) {
    return new Uint8Array(g.Buffer.from(padded, "base64"));
  }
  if (!g.atob) throw new Error("No base64 decoder available");
  const binary = g.atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
