const User = require("../model/User");
const { uploadToCloudinary } = require("../util/cloudnary");

// Upload files (user uploads)
exports.uploadFiles = async (req, res) => {
  try {
    const {
      docType,
      password,
      vehicleNo,
      udCardNo,
      email,
      uid,
      name,
      picture,
    } = req.body;

    const files = req.files;

    if (!email) return res.status(401).json({ error: "Missing email" });
    if (!docType || !files || files.length === 0) {
      return res.status(400).json({ error: "Missing document type or files" });
    }

    console.log("Upload request from:", email);

    const uploads = await Promise.all(
      files.map(async (file) => {
        const result = await uploadToCloudinary(file.buffer, "user_uploads");
        return {
          docType,
          fileName: file.originalname,
          fileUrl: result.secure_url,
          password,
          vehicleNo,
          udCardNo,
          uploadedAt: new Date(),
          status: "Uploaded",
        };
      })
    );

    let user = await User.findOne({ email });

    if (!user) {
      console.log("Creating new user:", email);
      user = new User({
        googleId: uid || "unknown",
        name: name || "Unknown",
        email,
        photoURL: picture || "",
        files: uploads,
      });
    } else {
      console.log("Existing user found. Appending files...");
      user.files.push(...uploads);
    }

    try {
      await user.save();
    } catch (saveErr) {
      console.error("User save failed:", saveErr);
      return res.status(500).json({ error: "User save failed", details: saveErr.message });
    }

    res.json({ message: "Upload successful", uploads });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
};

// Get user's own uploads (frontend sends ?email=...)
exports.getUserUploads = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.files || []);
  } catch (err) {
    console.error("Fetch user uploads error:", err);
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
};

// Admin posts a new file for a user
exports.postAdminFile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminMessage } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file provided" });

    const result = await uploadToCloudinary(file.buffer, "admin_files");

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.files.push({
      docType: "Admin Upload",
      fileName: file.originalname,
      adminFileUrl: result.secure_url,
      adminMessage,
      uploadedAt: new Date(),
      status: "Completed",
    });

    await user.save();

    res.json({
      message: "Admin file uploaded",
      fileUrl: result.secure_url,
    });
  } catch (err) {
    console.error("Admin upload error:", err);
    res.status(500).json({ error: "Admin file upload failed", details: err.message });
  }
};
