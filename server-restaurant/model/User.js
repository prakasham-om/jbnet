const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  docType: { type: String, required: true },
  fileName: { type: String },
  fileUrl: { type: String },
  password: { type: String },
  vehicleNo: { type: String },
  udCardNo: { type: String },
  status: { type: String, default: "Pending" },
  uploadedAt: { type: Date, default: Date.now },
  adminMessage: { type: String },
  adminFileUrl: { type: String },
});

const userSchema = new mongoose.Schema({
  googleId: { type: String },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  photoURL: { type: String },
  files: [fileSchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model("User", userSchema);
