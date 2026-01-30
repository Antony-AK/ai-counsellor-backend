import mongoose from "mongoose";

const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    website: String,
    portalUrl: String,


    matchScore: { type: Number, min: 0, max: 100 },

    fit: {
      type: String,
      enum: ["Dream", "Target", "Safe"]
    },

    tuition: Number,
    ranking: Number,

  },
  { _id: false }
);

const countryMatchSchema = new mongoose.Schema(
  {
    country: String,
    universities: [universitySchema]
  },
  { _id: false }
);



const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  onboardingCompleted: { type: Boolean, default: false },

  applicationStage: {
    type: String,
    enum: ["discovering", "applying"],
    default: "discovering"
  },

  profile: {
    educationLevel: {
      type: String,
      enum: ["High School", "Bachelor's Degree", "Master's Degree", "PhD"]
    },
    major: String,
    graduationYear: String,
    gpa: String,

    intendedDegree: {
      type: String,
      enum: ["Bachelor's", "Master's", "MBA", "PhD"]
    },
    fieldOfStudy: String,
    targetIntake: {
      type: String,
      enum: ["Fall 2025", "Spring 2025", "Fall 2026", "Spring 2026"]
    },
    preferredCountries: [String],

    budgetRange: {
      type: String,
      enum: ["Under $20K", "$20K - $40K", "$40K - $60K", "Over $60K"]
    },
    fundingPlan: {
      type: String,
      enum: ["Self-Funded", "Scholarship-Dependent", "Loan-Dependent"]
    },

    ieltsStatus: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"]
    },
    greStatus: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"]
    },
    sopStatus: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"]
    },

    shortlistedUniversities: [
      {
        name: String,
        country: String,
            portalUrl: String, // 🔥 ADD THIS
        locked: { type: Boolean, default: false },
        matchScore: Number,
        tuition: Number,
        ranking: Number,
        applicationDeadline: Date // 🔥 ADD THIS

      }
    ],

    applicationTasks: [
      {
        universityName: String,
        tasks: [
          {
            id: String,
            group: {
              type: String,
              enum: ["Documents", "Exams", "Forms"]
            },
            title: String,
            desc: String,
            priority: {
              type: String,
              enum: ["high", "medium"]
            },
            completed: {
              type: Boolean,
              default: false
            }
          }
        ]
      }
    ],
  },


  aiChats: [
    {
      role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
      },
      message: {
        type: String,
        required: true
      },
      context: {
        taskTitle: String,
        university: String
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],






  // 🔥 Computed data (NOT user input)
  universityMatches: [countryMatchSchema],

  profileVersion: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
