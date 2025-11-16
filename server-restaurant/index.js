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

// 🔥 Correct Allowed Origins
const allowedOrigins = [
  "https://jbnet.vercel.app",
  "http://localhost:3000",
  "https://code-seven-jet.vercel.app"
];

// ---------------- CORS for API ----------------
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // postman/mobile etc
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
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
    origin: allowedOrigins, // 🔥 FIXED HERE
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

const connected = {}; // email => socketId

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join", ({ email }) => {
    connected[email] = socket.id;
    console.log(`📲 ${email} joined`);
  });

  // Send and Save Message
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

      if (connected[receiver])
        io.to(connected[receiver]).emit("receive_message", payload);

      if (connected[sender])
        io.to(connected[sender]).emit("receive_message", payload);
    } catch (err) {
      console.error("❌ Failed to save message:", err.message);
    }
  });

  // Delete Message
  socket.on("delete_message", async ({ messageId, sender, receiver }) => {
    try {
      await Message.findByIdAndDelete(messageId);

      if (connected[sender])
        io.to(connected[sender]).emit("message_deleted", messageId);

      if (connected[receiver])
        io.to(connected[receiver]).emit("message_deleted", messageId);
    } catch (err) {
      console.error("❌ Failed to delete message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    const email = Object.keys(connected).find(
      (e) => connected[e] === socket.id
    );
    if (email) delete connected[email];
    console.log("🔴 Socket disconnected:", socket.id);
  });
});
