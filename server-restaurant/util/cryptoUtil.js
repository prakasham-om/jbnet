const crypto = require("crypto");

// Must be exactly 32 bytes for aes-256-cbc
const SECRET_KEY = Buffer.from("12345678901234567890123456789012"); // 32-char key
const ALGORITHM = "aes-256-cbc";

exports.encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

exports.decrypt = (text) => {
  if (!text || typeof text !== "string" || !text.includes(":")) {
    return "[Corrupted]";
  }

  const [ivHex, encryptedText] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
