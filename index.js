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

  try {
    const usersSnapshot = await db.collection("users").get();
    console.log(`📂 Fetched ${usersSnapshot.size} users from Firestore`);

    const tokens = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken && doc.id !== message.userId) {
        tokens.push(data.fcmToken);
        console.log(`📱 Added token for user: ${doc.id}`);
      }
    });

    if (tokens.length === 0) {
      console.warn('⚠️ No valid FCM tokens found for other users');
      return res.status(200).send("No tokens found for other users");
    }

    console.log(`🚀 Sending notification to ${tokens.length} device(s)`);

    const payload = {
      notification: {
        title: `${message.username} says:`,
        body: message.text,
        sound: "default",
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };

    const response = await admin.messaging().sendToDevice(tokens, payload);

    console.log('✅ Notifications sent results:');
    console.log('   Success count:', response.successCount);
    console.log('   Failure count:', response.failureCount);

    if (response.failureCount > 0) {
      const failedTokens = response.results
        .map((r, i) => r.error ? tokens[i] : null)
        .filter(token => token !== null);

      console.warn('❌ Failed tokens:', failedTokens);
      console.warn('❌ Failure details:', response.results.filter(r => r.error));
    }

    res.status(200).send(`Notifications sent: ${response.successCount}`);
  } catch (err) {
    console.error("❌ Error sending notifications:", err);
    if (err.errorInfo) {
      console.error("Error info:", err.errorInfo);
    }
    res.status(500).send("Error sending notifications: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
