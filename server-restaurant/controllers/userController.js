const User = require("../models/User");
const { uploadToCloudinary } = require("../util/cloudnary");

// Upload user files
exports.uploadFiles = async (req, res) => {
  try {
    const { docType, password, vehicleNo, udCardNo, email, uid, name, picture } = req.body;
    const files = req.files;

    console.log("📩 Upload Request from:", email);

    if (!email) return res.status(401).json({ error: "Missing email" });
    if (!docType || !files || files.length === 0) {
      return res.status(400).json({ error: "Missing document type or files" });
    }

    // Step 1: Find user first
    let user = await User.findOne({ email });

    if (!user) {
      // Create user first with empty files
      user = new User({
        googleId: uid || "unknown",
        name: name || "Unknown",
        email,
        photoURL: picture || "",
        files: [],
      });
      await user.save(); // Save user BEFORE uploading files
      console.log("✅ Created new user:", user.email);
    }

    // Step 2: Upload files AFTER user creation/fetch
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

    // Step 3: Add uploads to user.files and save again
    user.files.push(...uploads);
    await user.save();

    res.json({ message: "Upload successful", uploads });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "User with this email already exists." });
    }
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
};

// Get user uploads
exports.getUserUploads = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const user = await User.findOne({ email });
    res.json(user?.files || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
};

// Admin posts a file
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
    res.json({ message: "Admin file uploaded", fileUrl: result.secure_url });
  } catch (err) {
    console.error("Admin upload error:", err);
    res.status(500).json({ error: "Admin file upload failed", details: err.message });
  }
};

// Admin deletes a user file
exports.deleteUserFile = async (req, res) => {
  const { userId, fileIndex } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (fileIndex < 0 || fileIndex >= user.files.length) {
      return res.status(400).json({ error: "Invalid file index" });
    }

    // Remove the file from the array
    const deletedFile = user.files.splice(fileIndex, 1)[0];
    await user.save();

    res.json({ 
      message: "File deleted successfully",
      deletedFile
    });
  } catch (err) {
    console.error("File deletion error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
};
