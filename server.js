import express from "express";
import { initFirebase, sendPush } from "./firebase.js";
import { saveToken, allTokens, removeToken } from "./tokens.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Initialize Firebase ONCE at startup — Render keeps this process alive.
initFirebase();

// Health check — Render pings this to know the service is up.
app.get("/", (req, res) => res.json({ ok: true, service: "vw-push", time: Date.now() }));

// Android app POSTs here after login.
app.post("/api/fcm/register", (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing token" });
  const count = saveToken(token);
  console.log(`[register] ${platform || "android"} token stored, total=${count}`);
  res.json({ ok: true, count });
});

// Optional: called when a token is known to be dead (from FCM error).
app.post("/api/fcm/unregister", (req, res) => {
  const { token } = req.body || {};
  if (token) removeToken(token);
  res.json({ ok: true });
});

// Manual / bulk push. Protect with a shared secret.
app.post("/api/notify", async (req, res) => {
  const secret = req.headers["x-notify-secret"];
  if (secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { title, body, priority = "high", token } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body required" });

  const targets = token ? [token] : allTokens();
  if (targets.length === 0) return res.json({ ok: true, sent: 0, note: "no tokens" });

  const results = await Promise.allSettled(
    targets.map((t) => sendPush(t, title, body, priority))
  );

  // Clean up dead tokens
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const code = r.reason?.errorInfo?.code || r.reason?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        removeToken(targets[i]);
      }
    }
  });

  const sent = results.filter((r) => r.status === "fulfilled").length;
  res.json({ ok: true, sent, failed: results.length - sent });
});

// Your existing contact form handler. Add the push fan-out here.
app.post("/api/contact", async (req, res) => {
  const { name, message } = req.body || {};
  // ...save to your DB as before...

  const targets = allTokens();
  await Promise.allSettled(
    targets.map((t) =>
      sendPush(t, "New contact message", `${name}: ${(message || "").slice(0, 120)}`, "high")
    )
  );

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
