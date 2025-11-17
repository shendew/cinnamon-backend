import express from "express";
const router = express.Router();
import {
  loginUser,
  getUserProfile,
  updateUserProfile,
  registerAdmin,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { check } from "express-validator";
import { validate } from "../middleware/validate.js";

router.post(
  "/users/admin/register",
  [
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("phone", "Phone number is required").not().isEmpty(),
  ],
  validate,
  registerAdmin
);

router.post(
  "/users/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  validate,
  loginUser
);

router
  .route("/users/profile")
  .get(protect, getUserProfile)
  .put(
    protect,
    [
      check("name", "Name is required").not().isEmpty(),
      check("email", "Please include a valid email").isEmail(),
      check("phone", "Phone number is required").not().isEmpty(),
    ],
    validate,
    updateUserProfile
  );

export default router;
