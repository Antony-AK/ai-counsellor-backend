import axios from "axios";
import User from "../models/User.js";

export async function recalcUniversities(userId, mode = "ai") {
    const user = await User.findById(userId);
    const profile = user.profile;

    const map = {
        USA: "United States",
        UK: "United Kingdom",
        Canada: "Canada",
        Germany: "Germany",
        Australia: "Australia",
        Netherlands: "Netherlands",
        Singapore: "Singapore"
    };

    const preferred = Array.isArray(profile.preferredCountries)
        ? profile.preferredCountries.map(c => map[c] || c)
        : [];

    const ALL = ["Germany", "Canada", "Australia", "United States", "United Kingdom", "Netherlands", "Singapore"];

    const countries = ALL;


    const result = [];

    for (const country of countries) {
        let universities = [];

        if (country === "United States") {
            const res = await axios.get("https://api.data.gov/ed/collegescorecard/v1/schools", {
                params: {
                    api_key: process.env.COLLEGE_SCORECARD_KEY,
                    per_page: 30,
                    fields: "school.name,school.school_url"
                }
            });

            universities = res.data.results
                .filter(s => s["school.name"])     // 👈 remove bad rows
                .map(s => ({
                    name: s["school.name"],
                    website: s["school.school_url"] || "",
                    difficulty: guessDifficulty(s["school.name"])
                }));

        } else {
            const res = await axios.get(
                `http://universities.hipolabs.com/search?country=${country}`
            );
            universities = res.data
                .filter(u => u.name)
                .slice(0, 30)
                .map(u => ({
                    name: u.name,
                    website: u.web_pages?.[0] || "",
                    difficulty: guessDifficulty(u.name)
                }));

        }

        const enriched = universities.map(u => {
            let matchScore = calculateMatch(profile, u.difficulty, country);

            // 🎯 boost preferred countries
            if (preferred.includes(country)) {
                matchScore += 10;
            }

            matchScore = Math.min(100, matchScore);


            return {
                ...u,
                country,
                portalUrl: u.website || "",
                matchScore,
                fit:
                    matchScore >= 85 ? "Safe" :
                        matchScore >= 55 ? "Target" :
                            "Dream",
                tuition: estimateTuition(country),
                ranking: Math.floor(Math.random() * 100)
            };
        });



        result.push({ country, universities: enriched });
    }

    for (const c of result) {
        c.universities = c.universities.filter(u => u.name && u.name.trim());
    }

    user.universityMatches = result;
    user.profileVersion += 1;

    user.universityMode = mode;

    await user.save();
}



function calculateMatch(profile, difficulty, country) {
    let score = 40; // 🔥 lower base

    const gpa = parseFloat(profile.gpa) || 0;

    // GPA
    if (gpa >= 9) score += 20;
    else if (gpa >= 8) score += 15;
    else if (gpa >= 7) score += 8;
    else if (gpa >= 6) score -= 5;
    else score -= 20;

    // Exams
    if (profile.ieltsStatus === "Completed") score += 10;
    else score -= 10;

    if (profile.greStatus === "Completed") score += 5;
    else score -= 5;

    if (profile.sopStatus !== "Not Started") score += 5;
    else score -= 5;

    // Difficulty
    if (difficulty === "high") score -= 20;
    if (difficulty === "medium") score -= 8;
    if (difficulty === "low") score += 5;

    // Budget
    const tuition = estimateTuition(country);
    if (profile.budgetRange === "Under $20K") {
        if (tuition <= 20000) score += 10;
        else score -= 20;
    }

    return Math.max(0, Math.min(100, score));
}



function guessDifficulty(name = "") {
    const top = [
        "MIT", "Harvard", "Stanford", "Oxford", "Cambridge", "ETH",
        "Imperial", "UCL", "Toronto", "Munich", "Heidelberg", "Melbourne"
    ];

    const mid = ["University", "Institute", "Technology", "Tech"];

    const n = name.toLowerCase();

    if (top.some(x => n.includes(x.toLowerCase()))) return "high";
    if (mid.some(x => n.includes(x.toLowerCase()))) return "medium";
    return "low";
}


function estimateTuition(country) {
    if (country === "Germany") return 1500;
    if (country === "Canada") return 28000;
    if (country === "United States") return 42000;
    if (country === "United Kingdom") return 36000;
    if (country === "Australia") return 35000;
    return 30000;
}
