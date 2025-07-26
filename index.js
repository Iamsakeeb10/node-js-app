const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Chat notification server is running.");
});

// Add here:
app.get("/testFirestore", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").limit(3).get();
    const users = [];

    usersSnapshot.forEach(doc => {
      users.push(doc.data());
    });

    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("Firestore test failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Your existing /sendNotification route...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
