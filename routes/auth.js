import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { recalcUniversities } from "../service/universityEngine.js";

const router = express.Router();

const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ msg: "Password too short" });
  }


  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ msg: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    passwordHash: hash
  });

  const { passwordHash, ...safeUser } = user._doc;
  res.json({ token: createToken(user._id), user: safeUser });

});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) return res.status(400).json({ msg: "Account not found" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ msg: "Incorrect password" });

  const { passwordHash, ...safeUser } = user._doc;

  res.json({
    token: createToken(user._id),
    user: safeUser
  });
});


router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});



router.post("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.profile = {
      ...user.profile,
      ...req.body
    };

    // 🔥 THIS is what was missing
    user.profile.preferredCountries = req.body.preferredCountries;

    await user.save();


    res.json({ success: true, profile: user.profile });
  } catch (err) {
    console.error("PROFILE SAVE ERROR", err);
    res.status(500).json({ error: "Profile save failed" });
  }
});


router.put("/profile", protect, async (req, res) => {
  const user = await User.findById(req.user._id);

  user.profile = req.body;
  user.onboardingCompleted = true;


  await recalcUniversities(user._id);   // 👈 recalc when profile changes


  await user.save();
  res.json(user);
});

router.put("/onboarding", protect, async (req, res) => {
  const start = Date.now();

  try {
    const user = await User.findById(req.user._id);
    console.log("🟡 USER FETCHED", Date.now() - start, "ms");

    const cleanProfile = {};
    for (const key in req.body) {
      const val = req.body[key];
      if (Array.isArray(val)) {
        cleanProfile[key] = val;
      } else if (val !== "" && val != null) {
        cleanProfile[key] = val;
      }
    }

    user.profile = cleanProfile;
    user.onboardingCompleted = true;

    const requiredFields = [
      "educationLevel",
      "major",
      "graduationYear",
      "intendedDegree",
      "fieldOfStudy",
      "targetIntake",
      "budgetRange",
      "fundingPlan",
      "ieltsStatus",
      "sopStatus"
    ];

    for (const field of requiredFields) {
      if (!cleanProfile[field]) {
        return res.status(400).json({
          msg: `Missing required field: ${field}`
        });
      }
    }

    if (!cleanProfile.preferredCountries || cleanProfile.preferredCountries.length === 0) {
      return res.status(400).json({
        msg: "At least one preferred country is required"
      });
    }


    await user.save();
    console.log("🟢 PROFILE SAVED", Date.now() - start, "ms");

    res.json(user);
    console.log("🟢 RESPONSE SENT", Date.now() - start, "ms");

    // background
    setImmediate(() => {
      console.log("🔁 RE-CALC START");
      recalcUniversities(user._id)
        .then(() => console.log("✅ RE-CALC DONE"))
        .catch(err => console.error("❌ RE-CALC FAILED", err));
    });

  } catch (err) {
    console.error("🔥 ONBOARDING ERROR:", err);
    res.status(500).json({ msg: "Onboarding failed" });
  }
});


router.post("/tasks/toggle", protect, async (req, res) => {
  const { universityName, taskId } = req.body;

  const user = await User.findById(req.user._id);

  const uniTasks = user.profile.applicationTasks.find(
    u => u.universityName === universityName
  );

  if (!uniTasks) {
    return res.status(404).json({ error: "University tasks not found" });
  }

  const task = uniTasks.tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  // 🔥 TOGGLE
  task.completed = !task.completed;

  await user.save();

  res.json({ success: true, completed: task.completed });
});






export default router;
