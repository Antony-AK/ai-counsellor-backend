import express from "express";

import { protect } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

router.put("/onboarding", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.profile = req.body;
    user.onboardingCompleted = true;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: "Onboarding save failed" });
  }
});

router.get("/profile", protect, async (req, res) => {
  res.json(req.user.profile);
});



export default router;
