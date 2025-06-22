// controllers/userController.js
const User = require("../model/User");
const { uploadToCloudinary } = require("../util/cloudnary");

exports.uploadFiles = async (req, res) => {
  const { docType, password, vehicleNo, udCardNo } = req.body;
  console.log(req.body.email)
  const files = req.files;


  if (!req.body.email) {
    return res.status(401).json({ error: "Unauthorized: Missing user token" });
  }

  if (!docType || !files || files.length === 0) {
    return res.status(400).json({ error: "Missing document type or files" });
  }

  try {
  
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
          date: new Date(),
          status: "Uploaded",
        };
      })
    );


    let user = await User.findOne({ email: req.body.email });

    if (!user) {
      user = new User({
        googleId: req.body.uid,
        name: req.body.name || "Unknown User",
        email: req.body.email,
        photoURL: req.body.picture || "",
        files: uploads,
      });
    } else {
      user.files.push(...uploads);
    }

    await user.save();

    res.json({ message: "Upload successful", uploads });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message || "Failed to upload files" });
  }
};

exports.getUserUploads = async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findOne({ email: req.user.email });
    res.json(user?.files || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
};
