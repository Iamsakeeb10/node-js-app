const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

try {
  const isProduction = process.env.NODE_ENV === 'production';
  console.log("🌍 Environment:", isProduction ? "Production" : "Development");

  const serviceAccount = isProduction
    ? JSON.parse(process.env.SERVICE_ACCOUNT_KEY)
    : require("./serviceAccountKey.json");

  console.log("🔐 Loaded Service Account:");
  console.log("  Project ID:", serviceAccount.project_id);
  console.log("  Client Email:", serviceAccount.client_email);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  process.exit(1);
}

const db = admin.firestore();

app.get("/", (req, res) => {
  console.log("📬 Received GET / request");
  res.send("Chat notification server is running.");
});

app.get("/testNotification", async (req, res) => {
  // Replace this with your actual device's FCM token from Flutter app
  const testToken = "eUu6YnIjQjyiqsRU1YdAB-:APA91bEqlvNDOgDsIPrWhryKgrtU5CKWwKXt7GoKJzR42Xb_HgzjW4OcWs11ivq4EyWv2pj_Jo6QowwHJfcqtsESbRUGylFJVS7hMW6cCu0bhIPLgtiMTTg";
  

  try {
    const response = await admin.messaging().send({
      token: testToken,
      notification: {
        title: "Test Notification",
        body: "Hello from test endpoint!",
      },
    });
    console.log("✅ Test notification sent:", response);
    res.send("Test notification sent successfully");
  } catch (error) {
    console.error("❌ Error sending test notification:", error);
    res.status(500).send("Error sending test notification: " + error.message);
  }
});

app.post("/sendNotification", async (req, res) => {
  console.log("📬 Received POST /sendNotification request");

  const { message } = req.body;

  if (!message) {
    console.warn("⚠️ Message missing in request body");
    return res.status(400).send("Message missing");
  }

  console.log("📨 Sending notification for message:", message);
  console.log("📲 Received token:", message.fcmToken);

  try {
    // Optionally update the user's FCM token in Firestore
    if (message.fcmToken && message.userId) {
      await db.collection("users").doc(message.userId).update({
        fcmToken: message.fcmToken,
      });
      console.log(`✅ Updated user ${message.userId} FCM token in Firestore`);
    }

    const usersSnapshot = await db.collection("users").get();
    console.log(`📂 Fetched ${usersSnapshot.size} users from Firestore`);

    const tokens = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken && doc.id !== message.userId) {
        tokens.push({ token: data.fcmToken, userId: doc.id });
      }
    });

    if (tokens.length === 0) {
      console.warn('⚠️ No valid FCM tokens found for other users');
      return res.status(200).send("No tokens found for other users");
    }

    console.log(`🚀 Sending notification to ${tokens.length} device(s)`);

    const sendResults = [];

    for (const { token, userId } of tokens) {
      try {
        const response = await admin.messaging().send({
  token,
  notification: {
    title: `${message.username} says:`,
    body: message.text,
  },
  android: {
    notification: {
      sound: "default",
    },
  },
  data: {
    click_action: "FLUTTER_NOTIFICATION_CLICK",
  },
});


        console.log(`✅ Notification sent to ${userId}:`, response);
        sendResults.push({ token, success: true });
      } catch (error) {
        console.error(`❌ Failed to send to ${userId}:`, error.message);
        sendResults.push({ token, success: false, error: error.message });
      }
    }

    const successCount = sendResults.filter(r => r.success).length;
    const failureCount = sendResults.length - successCount;

    const failedTokens = sendResults
      .filter(r => !r.success)
      .map(r => r.token);

    if (failedTokens.length > 0) {
      console.warn("❌ Failed tokens:", failedTokens);
    }

    res.status(200).send(`✅ Notifications sent: ${successCount}, ❌ failed: ${failureCount}`);
  } catch (err) {
    console.error("❌ Error sending notifications:", err);
    res.status(500).send("Error sending notifications: " + err.message);
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
