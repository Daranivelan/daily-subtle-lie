import { getEnv } from "@/lib/d1";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const env = await getEnv();
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Admin not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  const cookie = parseCookie(request.headers.get("cookie"), "admin_token");
  const token = bearer || cookie;

  if (!token || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
