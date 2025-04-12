// models/Feedback.js
const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  // --- Common Fields ---
  source: { type: String, enum: ["Guest", "Staff"], required: true },
  timestamp: { type: Date, default: Date.now },
  sentiment: {
    type: String,
    enum: ["Positive", "Neutral", "Negative"],
    default: "Neutral"
  },
  comment: { type: String, trim: true, maxlength: 1000 }, // General comment field
  feedbackArea: { type: String, trim: true }, // e.g., Checkout, Room, Dining, Pool

  // --- Context Fields ---
  contextLoc: { type: String, trim: true }, // Location code (room, checkout)
  contextId: { type: String, trim: true }, // Specific ID (101, T44)
  contextToken: { type: String, trim: true }, // Token used
  contextGuestName: { type: String, trim: true }, // Associated guest name (if available)

  // --- General Guest Feedback Fields ---
  overallRating: { type: Number, min: 1, max: 5 },
  feedbackType: {
    type: String,
    enum: ["compliment", "complaint", "suggestion", "general"]
  },
  bookingReference: { type: String, trim: true }, // Or room number from general form
  contactConsent: { type: Boolean, default: false },
  otherComments: { type: String, trim: true, maxlength: 1000 },

  // --- Room Specific Fields ---
  roomCleanliness: { type: Number, min: 1, max: 5 },
  roomComfort: { type: Number, min: 1, max: 5 },
  roomNoise: { type: Number, min: 1, max: 5 },
  bathroomCleanliness: { type: Number, min: 1, max: 5 },
  roomAmenities: { type: Number, min: 1, max: 5 },
  roomComments: { type: String, trim: true, maxlength: 500 },

  // --- Dining Specific Fields ---
  foodQuality: { type: Number, min: 1, max: 5 },
  foodVariety: { type: Number, min: 1, max: 5 }, // Added from form example if relevant
  diningService: { type: Number, min: 1, max: 5 }, // From general form, applies here too?
  serviceSpeed: { type: Number, min: 1, max: 5 }, // From dining form
  staffAttentiveness: { type: Number, min: 1, max: 5 }, // From dining form
  ambianceRating: { type: Number, min: 1, max: 5 }, // From dining form
  diningComments: { type: String, trim: true, maxlength: 500 },

  // --- Amenities Specific Fields (Pool example) ---
  poolCleanliness: { type: Number, min: 1, max: 5 },
  seatingAvailability: { type: Number, min: 1, max: 5 },
  towelAvailability: { type: Number, min: 1, max: 5 },
  poolAmbiance: { type: Number, min: 1, max: 5 },
  // --- General Amenities Rating ---
  wifiRating: { type: Number, min: 1, max: 5 }, // From general form?
  restroomRating: { type: Number, min: 1, max: 5 }, // From general form?
  amenitiesComments: { type: String, trim: true, maxlength: 500 },

  // --- Staff/Service Specific Fields ---
  staffHelpfulness: { type: Number, min: 1, max: 5 },
  staffFriendliness: { type: Number, min: 1, max: 5 },
  receptionRating: { type: Number, min: 1, max: 5 }, // e.g., from general form?
  checkoutSpeed: { type: Number, min: 1, max: 5 }, // from checkout form
  checkoutStaffFriendliness: { type: Number, min: 1, max: 5 }, // from checkout form
  billingAccuracy: { type: Number, min: 1, max: 5 }, // from checkout form
  staffMention: { type: String, trim: true }, // From general form?
  staffComments: { type: String, trim: true, maxlength: 500 },
  checkoutComments: { type: String, trim: true, maxlength: 500 }, // From checkout form

  // --- Value ---
  valueRating: { type: Number, min: 1, max: 5 },

  // --- File Simulation ---
  simulatedFileNames: [{ type: String }], // Array of strings for filenames

  // --- Staff Log Specific Fields (from original StaffLogForm) ---
  category: {
    type: String,
    enum: ["Room", "Food", "Service", "Maintenance", "Other"]
  }, // Only for source=Staff
  severity: { type: String, enum: ["Low", "Medium", "High"] }, // Only for source=Staff
  location: { type: String, trim: true }, // Can overlap with contextId, maybe consolidate later
  details: { type: String, trim: true } // Staff log details
});

// Add index for faster querying, e.g., by timestamp or location
FeedbackSchema.index({ timestamp: -1 });
FeedbackSchema.index({ contextLoc: 1, contextId: 1 });

module.exports = mongoose.model("Feedback", FeedbackSchema);
