const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { encrypt, decrypt } = require("./util/cryptoUtil");
const Message = require("./model/Chat");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ---------------- ALLOWED ORIGINS ----------------
const allowedOrigins = [
  "https://jbnet.vercel.app",          // your frontend
  "https://code-seven-jet.vercel.app", // old frontend (optional)
  "http://localhost:3000"
];

// ---------------- CORS FOR EXPRESS API ----------------
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // mobile/postman etc.

      if (allowedOrigins.includes(origin)) {
        callback(null, origin);             // IMPORTANT FIX
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// ---------------- ROUTES ----------------
const adminRoutes = require("./routes/adminRoute");
const userRoutes = require("./routes/userRoute");
const chatRoutes = require("./routes/chatRoutes");

app.use("/api", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/messages", chatRoutes);

// ---------------- DATABASE ----------------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,   // MUST be an array — DO NOT use function here
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

const connectedUsers = {}; // email → socketId

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // ---------------- JOIN USER ----------------
  socket.on("join", ({ email }) => {
    connectedUsers[email] = socket.id;
    console.log(`📲 User joined: ${email}`);
  });

  // ---------------- SEND MESSAGE ----------------
  socket.on("send_message", async ({ sender, receiver, message }) => {
    if (!sender || !receiver || !message) return;

    try {
      const encryptedMessage = encrypt(message);

      const newMsg = new Message({
        sender,
        receiver,
        encryptedMessage,
        timestamp: new Date(),
      });

      await newMsg.save();

      const payload = {
        _id: newMsg._id,
        sender,
        receiver,
        message,
        timestamp: newMsg.timestamp,
      };

      // send to receiver if connected
      if (connectedUsers[receiver]) {
        io.to(connectedUsers[receiver]).emit("receive_message", payload);
      }

      // also send to sender
      if (connectedUsers[sender]) {
        io.to(connectedUsers[sender]).emit("receive_message", payload);
      }
    } catch (err) {
      console.error("❌ Failed to save message:", err.message);
    }
  });

  // ---------------- DELETE MESSAGE ----------------
  socket.on("delete_message", async ({ messageId, sender, receiver }) => {
    try {
      await Message.findByIdAndDelete(messageId);

      if (connectedUsers[sender]) {
        io.to(connectedUsers[sender]).emit("message_deleted", messageId);
      }

      if (connectedUsers[receiver]) {
        io.to(connectedUsers[receiver]).emit("message_deleted", messageId);
      }
    } catch (err) {
      console.error("❌ Failed to delete message:", err.message);
    }
  });

  // ---------------- DISCONNECT ----------------
  socket.on("disconnect", () => {
    const email = Object.keys(connectedUsers).find(
      (e) => connectedUsers[e] === socket.id
    );

    if (email) delete connectedUsers[email];

    console.log("🔴 Socket disconnected:", socket.id);
  });
});
