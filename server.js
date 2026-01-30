import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import authRoutes from "./routes/auth.js";
import { connectDB } from "./config/db.js";
import universityRoutes from "./routes/universities.js";
import profileRoutes from "./routes/profile.js";
import aiRoutes from "./routes/ai.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use("/auth", authRoutes);
app.use("/", universityRoutes);
app.use("/auth", profileRoutes);
app.use("/ai", aiRoutes);


// Health check
app.get("/", (req, res) => {
  res.send("AI Counsellor API is running 🚀");
});

app.listen(5000, () => {
    console.log("🚀 Server running on http://localhost:5000");
});
