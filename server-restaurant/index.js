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

// Frontend URL
const FRONTEND_URL = "http://localhost:3000";

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));
app.use(express.json());

// API Routes
const adminRoutes = require("./routes/adminRoute");
const userRoutes = require("./routes/userRoute");
const chatRoutes = require("./routes/chatRoutes");

app.use("/api", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/messages", chatRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}).catch(err => console.error("❌ MongoDB connection error:", err));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket']
});

const connected = {}; // email -> socket.id

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // Track user connection
  socket.on("join", ({ email }) => {
    connected[email] = socket.id;
    console.log(`📲 ${email} joined chat`);
  });

  // Receive and save message
  socket.on("send_message", async ({ sender, receiver, message }) => {
    if (!sender || !receiver || !message) {
      console.log("❌ Missing chat data");
      return;
    }

    try {
      const encryptedMessage = encrypt(message);

      const newMsg = new Message({
        sender,
        receiver,
        encryptedMessage,
        timestamp: new Date()
      });

      await newMsg.save();
      console.log("💾 Encrypted message saved:", newMsg);

      // Emit decrypted message to receiver
      const receiverSocketId = connected[receiver];
      const senderSocketId = connected[sender];

      const payload = {
        _id: newMsg._id,
        sender,
        receiver,
        message,
        timestamp: newMsg.timestamp
      };

      if (receiverSocketId) io.to(receiverSocketId).emit("receive_message", payload);
      if (senderSocketId) io.to(senderSocketId).emit("receive_message", payload);

    } catch (err) {
      console.error("❌ Failed to save message:", err.message);
    }
  });

  // Handle message deletion
  socket.on("delete_message", async ({ messageId, sender, receiver }) => {
    try {
      await Message.findByIdAndDelete(messageId);
      if (connected[sender]) io.to(connected[sender]).emit("message_deleted", messageId);
      if (connected[receiver]) io.to(connected[receiver]).emit("message_deleted", messageId);
    } catch (err) {
      console.error("❌ Failed to delete message:", err.message);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const email = Object.keys(connected).find(e => connected[e] === socket.id);
    if (email) delete connected[email];
    console.log("🔴 Socket disconnected:", socket.id);
  });
});
