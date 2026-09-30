import express from "express";
import { initFirebase, sendPush } from "./firebase.js";
import { saveToken, removeToken, tokensForUsers, allTokens, users } from "./tokens.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Notify-Secret");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "1mb" }));
initFirebase();

app.get("/", (req, res) => res.json({ ok: true, service: "vw-push", time: Date.now() }));

app.post("/api/fcm/register", (req, res) => {
  const { username, token } = req.body || {};
  if (!username || !token) return res.status(400).json({ error: "username and token required" });
  const count = saveToken(username, token);
  console.log(`[register] ${username} → ${count} device(s)`);
  res.json({ ok: true, count });
});

app.post("/api/fcm/unregister", (req, res) => {
  const { token } = req.body || {};
  if (token) removeToken(token);
  res.json({ ok: true });
});

app.get("/api/users", (req, res) => {
  if (req.headers["x-notify-secret"] !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ users: users() });
});

app.post("/api/notify", async (req, res) => {
  if (req.headers["x-notify-secret"] !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { title, body, priority = "high", to } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body required" });

  let targets;
  if (Array.isArray(to) && to.length > 0) targets = tokensForUsers(to);
  else if (typeof to === "string" && to.trim()) targets = tokensForUsers([to.trim()]);
  else targets = allTokens();

  if (targets.length === 0) {
    return res.json({ ok: true, sent: 0, note: to ? `no devices for ${to}` : "no tokens registered" });
  }

  const results = await Promise.allSettled(
    targets.map((t) => sendPush(t, title, body, priority))
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const code = r.reason?.errorInfo?.code || r.reason?.code || "";
      if (code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token") {
        removeToken(targets[i]);
      }
    }
  });

  const sent = results.filter((r) => r.status === "fulfilled").length;
  res.json({ ok: true, sent, failed: results.length - sent });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
