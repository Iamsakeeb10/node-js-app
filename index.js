const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK with your service account key
const serviceAccount = require("./serviceAccountKey.json"); // we'll get this soon

admin.initializeApp({
 credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// This is a simple GET endpoint to test server
app.get("/", (req, res) => {
 res.send("Chat notification server is running.");
});

// Listen for new chat messages (simple polling or webhook simulation)
app.post("/sendNotification", async (req, res) => {
 const { message } = req.body;

 if (!message) {
   return res.status(400).send("Message missing");
 }

 try {
   // Get all users (except sender if needed) from Firestore
   const usersSnapshot = await db.collection("users").get();

   const tokens = [];

   usersSnapshot.forEach((doc) => {
     const data = doc.data();
     if (data.fcmToken && data.userId !== message.userId) {
       tokens.push(data.fcmToken);
     }
   });

   if (tokens.length === 0) {
     return res.status(200).send("No tokens found");
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

   const response = await admin.messaging().sendToDevice(tokens, payload);
   res.status(200).send(`Notifications sent: ${response.successCount}`);
 } catch (err) {
   console.error("Error sending notifications", err);
   res.status(500).send("Error sending notifications");
 }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
});

