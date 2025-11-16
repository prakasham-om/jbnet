const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// const isAdmin = require("../middleware/isAdmin"); 
// Uncomment above line and add `isAdmin` in routes when ready.

/**
 * BASE PATH (in server.js):
 * app.use("/api", adminRoutes);
 *
 * Final API paths:
 * GET    /api/admin/users
 * PUT    /api/admin/user/:userId/file/:fileIndex
 * DELETE /api/admin/user/:userId/file/:fileIndex
 * DELETE /api/admin/user/:userId
 * GET    /api/admin/summary
 */

// ------------------------------
// Get All Users (with filters)
// ------------------------------
router.get("/admin/users", adminController.getUsers);
// Example: /api/admin/users?date=2025-06-19&search=alice

// ------------------------------
// Update a Specific User's File
// ------------------------------
router.put(
  "/admin/user/:userId/file/:fileIndex",
  // isAdmin,
  adminController.updateUserFile
);

// ------------------------------
// Get Summary / Revenue
// ------------------------------
router.get("/admin/summary", adminController.getSummary);

// ------------------------------
// Delete a Specific File from a User
// ------------------------------
router.delete(
  "/admin/user/:userId/file/:fileIndex",
  // isAdmin,
  adminController.deleteUserFile
);

// ------------------------------
// Delete a User Completely
// ------------------------------
router.delete(
  "/admin/user/:userId",
  // isAdmin,
  adminController.deleteUser
);

module.exports = router;
