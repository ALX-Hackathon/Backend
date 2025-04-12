// routes/feedback.js
const express = require('express');
const Feedback = require('../models/Feedback');
// Assuming keyword/SMS functions are defined above or required from utils
// const { checkIfNegative, sendSmsAlert } = require('../utils/feedbackUtils');

const router = express.Router();

// --- Helper Functions (Defined directly here for hackathon speed) ---

// Simple Keyword Lists (Expand these significantly for real use)
const NEGATIVE_KEYWORDS_ENG = ['bad', 'dirty', 'broken', 'slow', 'cold', 'poor', 'unhelpful', 'noise', 'smell', 'issue'];
const NEGATIVE_KEYWORDS_AMH = ['መጥፎ', 'ቆሻሻ', 'የተሰበረ', 'ቀርፋፋ', 'ቀዝቃዛ', 'ደካማ', 'የማይረዳ', 'ጫጫታ', 'ሽታ', 'ችግር', 'አይሰራም', 'እርጥበት']; // Needs more words!

function checkIfNegative(comment) {
  if (!comment) return false;
  const lowerComment = comment.toLowerCase();
  const allKeywords = [...NEGATIVE_KEYWORDS_ENG, ...NEGATIVE_KEYWORDS_AMH];
  return allKeywords.some(keyword => lowerComment.includes(keyword.toLowerCase())); // Case-insensitive check
}

// SMS Alert Function
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let twilioClient;
if (accountSid && authToken) {
  twilioClient = require('twilio')(accountSid, authToken);
} else {
    console.warn('Twilio credentials not found in .env file. SMS alerts disabled.');
}


async function sendSmsAlert(feedback) {
  const alertNumber = process.env.ALERT_PHONE_NUMBER;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioClient || !alertNumber || !twilioNumber) {
    console.error('Twilio client not initialized or phone numbers missing. Skipping SMS.');
    return; // Don't proceed if Twilio isn't set up
  }

  let body = `ALERT: Negative feedback received!\n`;
  body += `Source: ${feedback.source}\n`;
  if (feedback.rating !== undefined) body += `Rating: ${feedback.rating}★\n`; // check undefined as 0 could be valid if schema changes
  if (feedback.severity) body += `Severity: ${feedback.severity}\n`;
  if (feedback.location) body += `Location: ${feedback.location}\n`;
  if (feedback.roomNumber) body += `Room/Table: ${feedback.roomNumber}\n`;
  if (feedback.category) body += `Category: ${feedback.category}\n`;
  body += `Details: ${feedback.comment || feedback.details || 'N/A'}\n`;
  if (feedback.language) body += `Lang: ${feedback.language}`;

  try {
    console.log(`Attempting to send SMS alert to ${alertNumber}...`);
    const message = await twilioClient.messages.create({
       body: body.substring(0, 1600), // Limit length
       from: twilioNumber,
       to: alertNumber
     });
    console.log('SMS Sent successfully! SID:', message.sid);
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error.message);
  }
}

// --- Routes ---

// POST /api/feedback/guest - Create Guest Feedback
router.post('/guest', async (req, res) => {
  const { rating, comment, roomNumber, language } = req.body;
  try {
    const isNegative = checkIfNegative(comment);

    const newFeedback = new Feedback({
      source: 'Guest',
      rating,
      comment,
      roomNumber,
      language,
      isNegative, // Set based on keyword analysis
    });

    const savedFeedback = await newFeedback.save();

    // Trigger alert asynchronously if negative (don't wait for SMS)
    if (isNegative) {
      sendSmsAlert(savedFeedback).catch(err => console.error("Async SMS failed:", err)); // Log async errors
    }

    res.status(201).json(savedFeedback);
  } catch (error) {
    console.error('Error saving guest feedback:', error);
    res.status(500).json({ message: 'Server error while saving guest feedback.' });
  }
});

// POST /api/feedback/staff - Create Staff Feedback
router.post('/staff', async (req, res) => {
  const { category, severity, location, details } = req.body;
  try {
    // Staff high severity is considered negative for alert purposes
    const isNegative = severity === 'High';

    const newFeedback = new Feedback({
      source: 'Staff',
      category,
      severity,
      location,
      details,
      isNegative,
    });

    const savedFeedback = await newFeedback.save();

    // Trigger alert asynchronously if negative
    if (isNegative) {
       sendSmsAlert(savedFeedback).catch(err => console.error("Async SMS failed:", err)); // Log async errors
    }

    res.status(201).json(savedFeedback);
  } catch (error) {
    console.error('Error saving staff feedback:', error);
    res.status(500).json({ message: 'Server error while saving staff feedback.' });
  }
});

// GET /api/feedback - Get all Feedback logs
router.get('/', async (req, res) => {
  try {
    // Fetch all feedback, sorted by timestamp descending
    const feedbackList = await Feedback.find().sort({ timestamp: -1 });
    res.json(feedbackList);
  } catch (error) {
    console.error('Error fetching feedback logs:', error);
    res.status(500).json({ message: 'Server error while fetching feedback.' });
  }
});

// --- Temporary Token Validation for Testing ---
const validTestTokens = {
  'TEST_CHECKOUT_TOKEN_123': { valid: true, context: { /* guestName: "Test Guest One" Optional */ } },
  'TEST_ROOM101_TOKEN_ABC': { valid: true, context: { room: '101' } },
  'TEST_TABLET5_TOKEN': { valid: true, context: { table: 'T5' } },
  'USED_TOKEN': { valid: false, message: 'This feedback link has already been used.'} // Example used token
};

// GET /api/feedback/validate-token?tok=...&loc=...&id=...
router.get('/validate-token', async (req, res) => {
   const token = req.query.tok;
   const loc = req.query.loc; // Use location for context if needed
   const id = req.query.id;

   console.log(`Backend: Received validation request for token: ${token}, loc: ${loc}, id: ${id}`); // Debug log

    if (!token) {
       return res.status(400).json({ valid: false, message: 'Token is required for validation.' });
    }

   // --- Hardcoded Test Logic ---
    if (validTestTokens[token]) {
       console.log(`Backend: Test token '${token}' found, sending response:`, validTestTokens[token]);
        return res.status(200).json(validTestTokens[token]);
   } else {
        console.log(`Backend: Test token '${token}' not found or invalid.`);
        return res.status(404).json({ valid: false, message: 'Feedback session not found or expired.' });
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

// POST /api/feedback/contextual - Handles detailed, contextual feedback
router.post('/contextual', async (req, res) => {
  console.log("BACKEND: Received request body on /contextual:", JSON.stringify(req.body, null, 2)); // <-- ADD THIS LOG

  try {
      const { context, source, feedbackArea, ...feedbackData } = req.body; // Destructure body

      // ** Crucial: Validate context if needed **
      if (!context || !context.loc) {
          console.error("BACKEND Error: Missing location context.");
          return res.status(400).json({ message: "Feedback context (location) is required." });
      }
      // Optional: Could re-validate token here if needed, though ContextualFeedbackPage should do primary validation

      // Prepare data for saving, potentially flattening context
      const saveData = {
          ...feedbackData, // Includes ratings like checkoutSpeed, comments etc.
          source: source || 'Guest', // Default to Guest if not provided
          feedbackArea: feedbackArea || context.loc, // Use specific area or fallback to loc code

          // Store context information directly
          contextLoc: context.loc,
          contextId: context.id, // May be undefined
          contextToken: context.token, // May be undefined
           contextGuestName: context.guestName, // If backend provides it during validation

           // Determine isNegative (based on PRIMARY rating if available, or keywords)
           // Adjust this logic based on which rating is most indicative for the context
          isNegative: determineIsNegative(feedbackData, context.loc), // Pass data and location to helper

           timestamp: new Date(),
      };

      console.log("BACKEND: Prepared data for saving:", saveData); // <-- ADD THIS LOG

      // Create and Save to Database using Mongoose Model
      const newFeedback = new Feedback(saveData);
      const savedFeedback = await newFeedback.save();

      console.log("BACKEND: Feedback saved successfully:", savedFeedback._id); // <-- ADD THIS LOG

      // Check if negativity should trigger alert (only for certain types, e.g., Room issues?)
       if (saveData.isNegative /* && context.loc === 'room' */ ) { // Add conditions if needed
          // Trigger alert (reuse existing sendSmsAlert function)
          // Need to adapt sendSmsAlert if data structure is very different
          sendSmsAlert(savedFeedback).catch(err => console.error("Async SMS failed:", err));
      }

      res.status(201).json(savedFeedback); // Respond with saved data

  } catch (error) {
       // Catch Mongoose validation errors or other issues
      console.error('BACKEND Error: Saving contextual feedback failed:', error);
       // Check specifically for Mongoose validation errors
       if (error.name === 'ValidationError') {
           return res.status(400).json({ message: 'Validation Failed', errors: error.errors });
      }
      res.status(500).json({ message: 'Server error while saving feedback.' });
  }
});

// --- Helper function to determine negativity (Customize this!) ---
function determineIsNegative(feedbackData, location) {
   // Prioritize critical location flags maybe
  if (location === 'checkout' && (feedbackData.checkoutSpeed <= 2 || feedbackData.billingAccuracy <= 2)) return true;
  if (location === 'room' && (feedbackData.roomCleanliness <= 2 || feedbackData.bathroomCleanliness <= 2)) return true;
  if (location === 'dining_table' && feedbackData.foodQuality <= 2) return true;

   // Check for presence of strong negative keywords in *any* comment field
  const commentFields = ['checkoutComments', 'roomComments', 'diningComments', 'amenityComments', 'staffComments', 'otherComments'];
   for (const field of commentFields) {
       if (feedbackData[field] && checkIfNegative(feedbackData[field])) { // Reuse existing keyword checker
          return true;
      }
   }
   return false; // Default to not negative
}

// Ensure checkIfNegative function is defined/available in this file
// Ensure sendSmsAlert function is defined/available and handles the new 'saveData' structure


module.exports = router;