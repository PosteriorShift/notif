import admin from "firebase-admin";

let initialized = false;

export function initFirebase() {
  if (initialized) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing");

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  console.log("[firebase] initialized for project:", serviceAccount.project_id);
}

export async function sendPush(deviceToken, title, body, priority = "high") {
  const message = {
    token: deviceToken,
    notification: { title, body },
    data: { title, body, priority },
    android: {
      priority: priority === "high" ? "high" : "normal",
      notification: {
        channelId: "vv_default",   // matches NotifLite.CH_ID
        sound: "default",
      },
    },
  };
  return admin.messaging().send(message);
}
