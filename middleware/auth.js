import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // 1️⃣ Check if Authorization header exists
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No auth token provided" });
    }

    // 2️⃣ Extract token
    const token = header.split(" ")[1];

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ Fetch user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    // 5️⃣ Attach user to request (THIS is what your API needs)
    req.user = user;


    next(); // 🚀 continue to route
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};
