import express from "express";
import axios from "axios";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import { recalcUniversities } from "../service/universityEngine.js";

const router = express.Router();


router.get("/universities", protect, async (req, res) => {
    const mode = req.query.mode || "ai";

    const user = await User.findById(req.user._id);

    if (!user.universityMatches || user.universityMatches.length === 0) {
        await recalcUniversities(user._id);
    }

    const all = user.universityMatches;

    const preferred = user.profile.preferredCountries || [];
    const map = {
        USA: "United States",
        UK: "United Kingdom"
    };

    const preferredFull = preferred.map(c => map[c] || c);

    const filtered =
        mode === "ai"
            ? all.filter(c => preferredFull.includes(c.country))
            : all;

    res.json({ countries: filtered });
});




router.get("/us-universities", async (req, res) => {
    const url = "https://api.data.gov/ed/collegescorecard/v1/schools";
    const response = await axios.get(url, {
        params: {
            api_key: process.env.COLLEGE_SCORECARD_KEY,
            fields:
                "school.name,latest.admissions.admission_rate.overall,latest.cost.tuition.in_state,latest.student.size"
        }
    });

    res.json(response.data.results);
});


router.post("/analyze-university", async (req, res) => {
    const { university, website, profile } = req.body;

    const prompt = `
You are an expert study-abroad counsellor.

University: ${university}
Website: ${website}
Student Profile: ${JSON.stringify(profile)}

Give:
1. Required exams
2. Minimum GPA estimate
3. Acceptance difficulty (Low/Medium/High)
4. Scholarship chances
`;

    const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );

    res.json({
        analysis: response.data.choices[0].message.content
    });
});

router.post("/shortlist", protect, async (req, res) => {
    const { university } = req.body;
    const user = await User.findById(req.user._id);

    // 🔥 SAFETY INIT
    if (!Array.isArray(user.profile.shortlistedUniversities)) {
        user.profile.shortlistedUniversities = [];
    }

    const exists = user.profile.shortlistedUniversities.find(
        u => u.name === university.name
    );

    if (exists) {
        user.profile.shortlistedUniversities =
            user.profile.shortlistedUniversities.filter(
                u => u.name !== university.name
            );
    } else {
        user.profile.shortlistedUniversities.push({
            name: university.name,
            country: university.country,
            portalUrl: university.portalUrl, // 🔥 COPY HERE
            matchScore: university.matchScore,
            tuition: university.tuition,
            ranking: university.ranking,
            locked: false
        });
    }

    await user.save();
    res.json({
        shortlistedUniversities: user.profile.shortlistedUniversities,
        applicationStage: user.applicationStage || "discovering"
    });
});



router.post("/lock", protect, async (req, res) => {
    const { name } = req.body;
    const user = await User.findById(req.user._id);

    if (!Array.isArray(user.profile.shortlistedUniversities)) {
        return res.status(400).json({ msg: "No shortlisted universities" });
    }

    const uni = user.profile.shortlistedUniversities.find(u => u.name === name);
    if (!uni) return res.status(404).json({ msg: "Not shortlisted" });

    uni.locked = true;

    // 📅 Assign deadline (static for hackathon is OK)
    uni.applicationDeadline = new Date("2024-12-15");


    // 🔥 NEW LOGIC (this is the key)
    user.applicationStage = "applying";

    const hasAnyLocked = user.profile.shortlistedUniversities.some(u => u.locked);

    if (!hasAnyLocked) {
        user.applicationStage = "discovering";
    }

    await user.save();

    res.json({
        shortlistedUniversities: user.profile.shortlistedUniversities,
        applicationStage: user.applicationStage
    });
});



export default router;
