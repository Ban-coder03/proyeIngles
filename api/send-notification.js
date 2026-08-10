// ==========================================================================
// /api/send-notification.js — Serverless Function (Vercel + Node.js)
// CTP Santa Lucía · Alert System
// ==========================================================================
// Reads all tokens saved in Firestore and sends a mass push notification
// using the Firebase Admin SDK.
//
// ⚠️ This file runs on the SERVER (never in the browser), so private
// credentials belong here — but ALWAYS via Vercel environment variables,
// never written directly into the code.

import admin from "firebase-admin";

// --------------------------------------------------------------------------
// 1) INITIALIZE FIREBASE ADMIN (only once, reusing the instance between
//    function invocations for better efficiency)
// --------------------------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Private keys are usually stored with escaped "\n" in environment
      // variables; they need to be converted back to real line breaks.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// --------------------------------------------------------------------------
// 2) HANDLER
// --------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { title, body, type } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({ error: "Missing 'title' or 'body' field." });
    }

    // Read all tokens saved in the "tokens" collection
    const snapshot = await db.collection("tokens").get();
    const tokens = snapshot.docs.map((doc) => doc.data().token).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(200).json({ successCount: 0, message: "No subscribed devices." });
    }

    // Firebase Admin allows a maximum of 500 tokens per call to
    // sendEachForMulticast, so we split into batches for safety.
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);

      const message = {
        notification: { title, body },
        data: { type: type || "general" },
        tokens: batchTokens,
        webpush: {
          fcmOptions: { link: "/" },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Identify invalid/expired tokens to clean them up from Firestore
      response.responses.forEach((r, idx) => {
        if (
          !r.success &&
          (r.error?.code === "messaging/invalid-registration-token" ||
            r.error?.code === "messaging/registration-token-not-registered")
        ) {
          invalidTokens.push(batchTokens[idx]);
        }
      });
    }

    // Automatic cleanup of invalid tokens (optional but recommended)
    if (invalidTokens.length > 0) {
      const batch = db.batch();
      invalidTokens.forEach((token) => {
        batch.delete(db.collection("tokens").doc(token));
      });
      await batch.commit();
    }

    return res.status(200).json({
      successCount,
      failureCount,
      tokensRemoved: invalidTokens.length,
    });
  } catch (err) {
    console.error("Error sending notification:", err);
    return res.status(500).json({ error: "Internal error while sending the notification." });
  }
}
