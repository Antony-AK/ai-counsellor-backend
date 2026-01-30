import express from "express";
import OpenAI from "openai";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Counsellor Hackathon"
    }
});


router.post("/chat", protect, async (req, res) => {
    const user = await User.findById(req.user._id);
    const { message } = req.body;

    // 1️⃣ Save user message
    user.aiChats.push({
        role: "user",
        message
    });

    const systemPrompt = `
You are an AI Study Abroad Counsellor inside a premium web application.

This is the student's live profile from the database:
${JSON.stringify(user.profile, null, 2)}

Your personality:
You are warm, clear, professional, and motivating.
You guide decisions like a real counsellor.
You use emojis naturally to improve readability.
You write in short, clean, spaced sections.

You NEVER use:
- ###
- Markdown
- bullet symbols (-, •)
- numbered lists

Instead, use this visual style:

Emoji + Section Title  
Short paragraphs  
Each item on its own line with emojis  

Example:

🎓 Your Profile  
You are aiming for a Master’s in Information Technology in Germany.  
Your academic foundation in AI and Data Science is a strong advantage.

🌍 Dream Universities  
🏫 Technical University of Munich  
This is an excellent fit because…

🏫 RWTH Aachen University  
This university is strong in…

Your responsibilities:
Understand the student’s academic profile, budget, countries, and exam status.  
Identify strengths and gaps.  
Recommend universities in Dream, Target, and Safe groups.  
Explain clearly why each university fits or is risky.  
Suggest next best actions.

When universities are suggested, always format like this:

🌟 Dream Universities  
🏫 University Name  
Why it fits or why it is competitive  

🎯 Target Universities  
🏫 University Name  
Why it is a good balance of chance and quality  

🛡 Safe Universities  
🏫 University Name  
Why it is a safer admission option  

When suggesting actions, write them like:

🧭 Next Steps  
📘 IELTS preparation  
✍️ Start SOP  
🎓 Scholarship research  

If the user asks to take an action (shortlist, lock, create a task), respond ONLY in this JSON format:

{
  "action": "shortlist | lock | add_task",
  "data": {
    "university": "Name",
    "category": "Dream | Target | Safe",
    "task": "optional"
  }
}

Otherwise reply only in the styled natural language format above.
`;

    // 3️⃣ Call AI
    const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            ...user.aiChats.slice(-6).map(c => ({
                role: c.role === "assistant" ? "assistant" : "user",
                content: c.message
            }))
        ],
        max_tokens: 600,
        temperature: 0.6
    });

    const aiReply = completion.choices[0].message.content;

    // 4️⃣ Save AI reply
    user.aiChats.push({
        role: "assistant",
        message: aiReply
    });

    await user.save();

    res.json({ result: aiReply });
});


router.get("/chat/history", protect, async (req, res) => {
    const user = await User.findById(req.user._id);

    // 1️⃣ If chat already exists → return it
    if (user.aiChats.length > 0) {
        return res.json({ chats: user.aiChats });
    }

    // 2️⃣ Else generate welcome ONCE
    const introPrompt = `
You are an AI Study Abroad Counsellor inside a premium web application.

This is the student's live profile from the database:
${JSON.stringify(user.profile, null, 2)}

Your personality:
You are warm, clear, professional, and motivating.
You guide decisions like a real counsellor.
You use emojis naturally to improve readability.
You write in short, clean, spaced sections.

STRICT STYLE RULES (VERY IMPORTANT):
You MUST follow this format exactly.
You MUST NOT use:
- Markdown
- bullet symbols (-, •)
- numbered lists
- bold text
- placeholders like [Degree]

You MUST use this visual style only:

Emoji + Section Title  
Short natural sentences  
Each line on its own  
Friendly but professional tone  

Now introduce yourself and summarize the student profile like this:

🎓 Your Profile  
Mention the intended degree and field of study clearly.  

🌍 Preferred Countries  
List the countries the student is targeting in a natural sentence.  

💰 Budget Overview  
Explain the student’s budget range simply.  

📝 Exam Readiness  
Mention IELTS, GRE, and SOP status clearly.  

If any information is missing, politely mention it.

End with this section:

🧭 What would you like to explore next?  
Invite the student to ask about universities, chances, or next steps.

DO NOT include anything outside this structure.
`;


    const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
            { role: "system", content: introPrompt }
        ],
        max_tokens: 600,
        temperature: 0.6
    });

    const intro = completion.choices[0].message.content;

    user.aiChats.push({
        role: "assistant",
        message: intro
    });

    await user.save();

    res.json({ chats: user.aiChats });
});



router.post("/generate-tasks", protect, async (req, res) => {
    const { universityName } = req.body;
    const user = await User.findById(req.user._id);

    const uni = user.profile.shortlistedUniversities.find(
        u => u.name === universityName
    );

    if (!uni) {
        return res.status(400).json({ error: "University not found" });
    }

    // 🔥 DEFINE aiProfile (THIS WAS MISSING)
    const aiProfile = {
        educationLevel: user.profile.educationLevel,
        major: user.profile.major,
        gpa: user.profile.gpa,
        intendedDegree: user.profile.intendedDegree,
        fieldOfStudy: user.profile.fieldOfStudy,
        targetIntake: user.profile.targetIntake,
        ieltsStatus: user.profile.ieltsStatus,
        greStatus: user.profile.greStatus,
        sopStatus: user.profile.sopStatus
    };

    const prompt = `
You are an AI Study Abroad Counsellor.

Return ONLY valid JSON.
You MUST complete the JSON fully.
You MUST close all brackets.
NO markdown.
NO explanations.



Format EXACTLY like:

{
  "tasks": [
    {
      "id": "string",
      "group": "Documents | Exams | Forms",
      "title": "string",
      "desc": "string",
      "priority": "high | medium"
    }
  ]
}

University:
${uni.name} (${uni.country})

Student profile:
${JSON.stringify(aiProfile)}
`;

    const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        max_tokens: 600,   
        temperature: 0.4
    });


    const raw = completion.choices[0].message.content;

    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.error("❌ AI RESPONSE:", raw);
        return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    if (!Array.isArray(parsed.tasks)) {
        return res.status(500).json({ error: "AI tasks missing" });
    }

    await User.findByIdAndUpdate(user._id, {
        $pull: { "profile.applicationTasks": { universityName } }
    });

    await User.findByIdAndUpdate(user._id, {
        $push: {
            "profile.applicationTasks": {
                universityName,
                tasks: parsed.tasks.map(t => ({
                    ...t,
                    completed: false
                }))
            }
        }
    });

    res.json({ tasks: parsed.tasks });
});


export default router;
