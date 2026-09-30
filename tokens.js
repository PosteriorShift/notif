// Simple in-memory token store. Survives while the process is awake.
// On Render free tier that's usually hours. If you want persistence
// across redeploys, use Render Postgres, Mongo, or Upstash Redis.
const tokens = new Set();

export function saveToken(token) {
  if (token) tokens.add(token);
  return tokens.size;
}

export function removeToken(token) {
  tokens.delete(token);
}

export function allTokens() {
  return Array.from(tokens);
}
