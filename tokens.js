// tokens.js — tokens grouped by username
// Map<username, Set<token>>
const byUser = new Map();

export function saveToken(username, token) {
  if (!username || !token) return 0;
  if (!byUser.has(username)) byUser.set(username, new Set());
  byUser.get(username).add(token);
  return byUser.get(username).size;
}

export function removeToken(token) {
  for (const set of byUser.values()) set.delete(token);
}

/** All tokens for the given usernames. */
export function tokensForUsers(usernames) {
  const out = [];
  for (const u of usernames) {
    const set = byUser.get(u);
    if (set) for (const t of set) out.push(t);
  }
  return out;
}

/** All tokens for everyone. */
export function allTokens() {
  const out = [];
  for (const set of byUser.values()) for (const t of set) out.push(t);
  return out;
}

/** Everyone who has at least one token. Useful for a "Send to" dropdown. */
export function users() {
  return Array.from(byUser.entries())
    .filter(([, set]) => set.size > 0)
    .map(([u, set]) => ({ user: u, devices: set.size }));
}
