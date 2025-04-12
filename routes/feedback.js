// routes/feedback.js
const express = require("express");
const Feedback = require("../models/Feedback");
// Assuming keyword/SMS functions are defined above or required from utils
// const { checkIfNegative, sendSmsAlert } = require('../utils/feedbackUtils');
const { authenticate, authorizeAdmin } = require("../middleware/auth");

const router = express.Router();


// New helper function for sentiment analysis using the Gemini API
async function analyzeSentiment(comment) {
  if (!comment) return "Neutral";
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return "Neutral";
  const MODEL_NAME = "gemini-1.5-flash-latest";
  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

  const systemPrompt =
    "You are a sentiment analysis tool. Analyze the sentiment of the following comment. Return only one word: Positive, Neutral, or Negative. Comment: " +
    comment;
  const requestBody = {
    contents: [
      {
        parts: [{ text: systemPrompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: 10,
      temperature: 0.0
    }
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      console.error("Sentiment analysis API error:", response.status);
      return "Neutral";
    }
    const data = await response.json();
    let result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (result) {
      result = result.trim().toLowerCase();
      if (result.includes("positive")) return "Positive";
      if (result.includes("negative")) return "Negative";
    }
    return "Neutral";
  } catch (err) {
    console.error("Error during sentiment analysis:", err);
    return "Neutral";
  }
}

// SMS Alert Function
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let twilioClient;
if (accountSid && authToken) {
  twilioClient = require("twilio")(accountSid, authToken);
} else {
  console.warn(
    "Twilio credentials not found in .env file. SMS alerts disabled."
  );
}

async function sendSmsAlert(feedback) {
  const alertNumber = process.env.ALERT_PHONE_NUMBER;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioClient || !alertNumber || !twilioNumber) {
    console.error(
      "Twilio client not initialized or phone numbers missing. Skipping SMS."
    );
    return; // Don't proceed if Twilio isn't set up
  }

  let body = `ALERT: Negative feedback received!\n`;
  body += `Source: ${feedback.source}\n`;
  if (feedback.rating !== undefined) body += `Rating: ${feedback.rating}★\n`; // check undefined as 0 could be valid if schema changes
  if (feedback.severity) body += `Severity: ${feedback.severity}\n`;
  if (feedback.location) body += `Location: ${feedback.location}\n`;
  if (feedback.roomNumber) body += `Room/Table: ${feedback.roomNumber}\n`;
  if (feedback.category) body += `Category: ${feedback.category}\n`;
  body += `Details: ${feedback.comment || feedback.details || "N/A"}\n`;
  if (feedback.language) body += `Lang: ${feedback.language}`;

  try {
    console.log(`Attempting to send SMS alert to ${alertNumber}...`);
    const message = await twilioClient.messages.create({
      body: body.substring(0, 1600), // Limit length
      from: twilioNumber,
      to: alertNumber
    });
    console.log("SMS Sent successfully! SID:", message.sid);
  } catch (error) {
    console.error("Error sending SMS via Twilio:", error.message);
  }
}

// --- Routes ---

/**
 * @swagger
 * /api/feedback/guest:
 *   post:
 *     summary: Create guest feedback.
 *     tags:
 *       - Feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *               comment:
 *                 type: string
 *               roomNumber:
 *                 type: string
 *               language:
 *                 type: string
 *     responses:
 *       201:
 *         description: Guest feedback created successfully.
 *       500:
 *         description: Server error.
 */
router.post("/guest", async (req, res) => {
  const { rating, comment, roomNumber, language } = req.body;
  try {
    const sentiment = await analyzeSentiment(comment); // Use sentiment analysis only

    const newFeedback = new Feedback({
      source: "Guest",
      rating,
      comment,
      roomNumber,
      language,
      sentiment // Store sentiment result from API
    });

    const savedFeedback = await newFeedback.save();

    // Trigger SMS alert if sentiment is Negative
    if (sentiment === "Negative") {
      sendSmsAlert(savedFeedback).catch((err) =>
        console.error("Async SMS failed:", err)
      );
    }
    console.log("Feedback saved successfully:", savedFeedback); // Debug log
    res.status(201).json(savedFeedback);
  } catch (error) {
    console.error("Error saving guest feedback:", error);
    res
      .status(500)
      .json({ message: "Server error while saving guest feedback." });
  }
});

/**
 * @swagger
 * /api/feedback/staff:
 *   post:
 *     summary: Create staff feedback.
 *     tags:
 *       - Feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *               severity:
 *                 type: string
 *               location:
 *                 type: string
 *               details:
 *                 type: string
 *     responses:
 *       201:
 *         description: Staff feedback created successfully.
 *       500:
 *         description: Server error.
 */
router.post("/staff", async (req, res) => {
  const { category, severity, location, details } = req.body;
  try {
    const newFeedback = new Feedback({
      source: "Staff",
      category,
      severity,
      location,
      details
    });

    const savedFeedback = await newFeedback.save();

    // Trigger SMS alert if severity is High
    if (severity === "High") {
      sendSmsAlert(savedFeedback).catch((err) =>
        console.error("Async SMS failed:", err)
      );
    }

    res.status(201).json(savedFeedback);
  } catch (error) {
    console.error("Error saving staff feedback:", error);
    res
      .status(500)
      .json({ message: "Server error while saving staff feedback." });
  }
});

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Retrieve all feedback logs (Admins only).
 *     tags:
 *       - Feedback
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of feedback logs.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden for non-admin users.
 */
router.get("/", authenticate, authorizeAdmin, async (req, res) => {
  try {
    // Fetch all feedback, sorted by timestamp descending
    const feedbackList = await Feedback.find().sort({ timestamp: -1 });
    res.json(feedbackList);
  } catch (error) {
    console.error("Error fetching feedback logs:", error);
    res.status(500).json({ message: "Server error while fetching feedback." });
  }
});

// --- Temporary Token Validation for Testing ---
const validTestTokens = {
  TEST_CHECKOUT_TOKEN_123: {
    valid: true,
    context: {
      /* guestName: "Test Guest One" Optional */
    }
  },
  TEST_ROOM101_TOKEN_ABC: { valid: true, context: { room: "101" } },
  TEST_TABLET5_TOKEN: { valid: true, context: { table: "T5" } },
  USED_TOKEN: {
    valid: false,
    message: "This feedback link has already been used."
  } // Example used token
};

/**
 * @swagger
 * /api/feedback/validate-token:
 *   get:
 *     summary: Validate feedback token.
 *     tags:
 *       - Feedback
 *     parameters:
 *       - in: query
 *         name: tok
 *         schema:
 *           type: string
 *         required: true
 *         description: The feedback token.
 *       - in: query
 *         name: loc
 *         schema:
 *           type: string
 *         description: Feedback location.
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Context id.
 *     responses:
 *       200:
 *         description: Valid token.
 *       400:
 *         description: Token is required.
 *       404:
 *         description: Invalid or expired token.
 */
router.get("/validate-token", async (req, res) => {
  const token = req.query.tok;
  const loc = req.query.loc; // Use location for context if needed
  const id = req.query.id;

  console.log(
    `Backend: Received validation request for token: ${token}, loc: ${loc}, id: ${id}`
  ); // Debug log

  if (!token) {
    return res
      .status(400)
      .json({ valid: false, message: "Token is required for validation." });
  }

  // --- Hardcoded Test Logic ---
  if (validTestTokens[token]) {
    console.log(
      `Backend: Test token '${token}' found, sending response:`,
      validTestTokens[token]
    );
    return res.status(200).json(validTestTokens[token]);
  } else {
    console.log(`Backend: Test token '${token}' not found or invalid.`);
    return res.status(404).json({
      valid: false,
      message: "Feedback session not found or expired."
    });
  }
  // --- End Hardcoded Logic ---

  /* // --- Real Logic Placeholder ---
    try {
        // 1. Find token in database
        const feedbackToken = await FeedbackTokenModel.findOne({ token: token }); // Example model

        // 2. Check if exists, not expired, and not used
        if (!feedbackToken || feedbackToken.used || feedbackToken.expiresAt < new Date()) {
            return res.status(404).json({ valid: false, message: 'Feedback session not found, expired, or already used.' });
        }

        // 3. Optional: Mark as 'pending' or log access attempt?
        // feedbackToken.status = 'pending';
        // await feedbackToken.save();

        // 4. Return success and any relevant context (e.g., guest name)
        return res.status(200).json({ valid: true, context: { bookingId: feedbackToken.bookingId, guestName: feedbackToken.guestName } }); // Example context

    } catch (error) {
        console.error("Token validation DB error:", error);
        return res.status(500).json({ valid: false, message: 'Server error during token validation.' });
    }
    // --- End Real Logic Placeholder --- */
});

// ... rest of your feedback routes (/contextual POST endpoint etc.) ...

// routes/feedback.js (Backend)

/**
 * @swagger
 * /api/feedback/contextual:
 *   post:
 *     summary: Submit detailed contextual feedback.
 *     tags:
 *       - Feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 properties:
 *                   loc:
 *                     type: string
 *                   id:
 *                     type: string
 *                   token:
 *                     type: string
 *                   guestName:
 *                     type: string
 *               source:
 *                 type: string
 *               feedbackArea:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contextual feedback created successfully.
 *       400:
 *         description: Validation error.
 *       500:
 *         description: Server error.
 */
router.post("/contextual", async (req, res) => {
  console.log(
    "BACKEND: Received request body on /contextual:",
    JSON.stringify(req.body, null, 2)
  ); // <-- ADD THIS LOG

  try {
    const { context, source, feedbackArea, ...feedbackData } = req.body; // Destructure body

    // ** Crucial: Validate context if needed **
    if (!context || !context.loc) {
      console.error("BACKEND Error: Missing location context.");
      return res
        .status(400)
        .json({ message: "Feedback context (location) is required." });
    }
    // Optional: Could re-validate token here if needed, though ContextualFeedbackPage should do primary validation

    // Prepare data for saving, potentially flattening context
    const saveData = {
      ...feedbackData, // Includes ratings like checkoutSpeed, comments etc.
      source: source || "Guest", // Default to Guest if not provided
      feedbackArea: feedbackArea || context.loc, // Use specific area or fallback to loc code

      // Store context information directly
      contextLoc: context.loc,
      contextId: context.id, // May be undefined
      contextToken: context.token, // May be undefined
      contextGuestName: context.guestName, // If backend provides it during validation

      // Determine isNegative (based on PRIMARY rating if available, or keywords)
      // Adjust this logic based on which rating is most indicative for the context
      isNegative: determineIsNegative(feedbackData, context.loc), // Pass data and location to helper

      timestamp: new Date()
    };

    console.log("BACKEND: Prepared data for saving:", saveData); // <-- ADD THIS LOG

    // Create and Save to Database using Mongoose Model
    const newFeedback = new Feedback(saveData);
    const savedFeedback = await newFeedback.save();

    console.log("BACKEND: Feedback saved successfully:", savedFeedback._id); // <-- ADD THIS LOG

    // Check if negativity should trigger alert (only for certain types, e.g., Room issues?)
    if (saveData.isNegative /* && context.loc === 'room' */) {
      // Add conditions if needed
      // Trigger alert (reuse existing sendSmsAlert function)
      // Need to adapt sendSmsAlert if data structure is very different
      sendSmsAlert(savedFeedback).catch((err) =>
        console.error("Async SMS failed:", err)
      );
    }

    res.status(201).json(savedFeedback); // Respond with saved data
  } catch (error) {
    // Catch Mongoose validation errors or other issues
    console.error("BACKEND Error: Saving contextual feedback failed:", error);
    // Check specifically for Mongoose validation errors
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Failed", errors: error.errors });
    }
    res.status(500).json({ message: "Server error while saving feedback." });
  }
});

// --- Helper function to determine negativity (Customize this!) ---
function determineIsNegative(feedbackData, location) {
  // Prioritize critical location flags maybe
  if (
    location === "checkout" &&
    (feedbackData.checkoutSpeed <= 2 || feedbackData.billingAccuracy <= 2)
  )
    return true;
  if (
    location === "room" &&
    (feedbackData.roomCleanliness <= 2 || feedbackData.bathroomCleanliness <= 2)
  )
    return true;
  if (location === "dining_table" && feedbackData.foodQuality <= 2) return true;

  // Check for presence of strong negative keywords in *any* comment field
  const commentFields = [
    "checkoutComments",
    "roomComments",
    "diningComments",
    "amenityComments",
    "staffComments",
    "otherComments"
  ];
  for (const field of commentFields) {
    if (feedbackData[field] && checkIfNegative(feedbackData[field])) {
      // Reuse existing keyword checker
      return true;
    }
  }
  return false; // Default to not negative
}

// Ensure checkIfNegative function is defined/available in this file
// Ensure sendSmsAlert function is defined/available and handles the new 'saveData' structure

module.exports = router;
