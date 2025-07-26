const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

try {
 const isProduction = process.env.NODE_ENV === 'production';
const serviceAccount = isProduction
  ? JSON.parse(process.env.SERVICE_ACCOUNT_KEY)
  : require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
  
  console.log('✅ Firebase Admin initialized successfully');
  console.log('Project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  process.exit(1);
}

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Chat notification server is running.");
});

app.post("/sendNotification", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send("Message missing");
  }

  try {
    console.log('📨 Sending notification for message:', message);
    
    const usersSnapshot = await db.collection("users").get();
    const tokens = [];

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken && doc.id !== message.userId) {
        tokens.push(data.fcmToken);
        console.log('📱 Added token for user:', doc.id);
      }
    });

    if (tokens.length === 0) {
      console.log('⚠️ No tokens found for other users');
      return res.status(200).send("No tokens found for other users");
    }

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

    console.log('🚀 Sending to', tokens.length, 'devices');
    const response = await admin.messaging().sendToDevice(tokens, payload);
    
    console.log('✅ Success count:', response.successCount);
    console.log('❌ Failure count:', response.failureCount);
    
    if (response.failureCount > 0) {
      console.log('Failed results:', response.results.filter(r => r.error));
    }

    res.status(200).send(`Notifications sent: ${response.successCount}`);
  } catch (err) {
    console.error("❌ Error sending notifications:", err);
    res.status(500).send("Error sending notifications: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});