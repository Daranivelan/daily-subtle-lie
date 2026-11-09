import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDB() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}
