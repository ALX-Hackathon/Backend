// routes/chat.js (Backend)
require("dotenv").config();
const express = require("express");
// No Google AI SDK import needed now
const Feedback = require("../models/Feedback");

const router = express.Router();

// --- Environment Variable Check ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // LOAD FROM ENV!
if (!GEMINI_API_KEY) {
  console.error(
    "FATAL: GEMINI_API_KEY environment variable not set. Chat API cannot function."
  );
  // Consider exiting the process or disabling the route if the key is critical and missing
  // process.exit(1);
}

// --- Model Name Definition ---
// Use a valid, available model name. Check Google AI documentation.
const MODEL_NAME = "gemini-1.5-flash-latest"; // Stable & Efficient Option
// const MODEL_NAME = "gemini-pro"; // Might work depending on endpoint/API version accessed by REST

// Construct the API endpoint URL
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// --- Input Sanitization ---
const sanitizeInput = (text) => {
  if (!text) return "";
  return text.replace(/[<>{}]/g, ""); // Basic
};

// --- Chat History Store (Keep for potential future use, though not used in this simple fetch) ---
const chatHistoryStore = {};
const MAX_HISTORY_LENGTH = 10;

// --- getDashboardSummary (Keep as is) ---
async function getDashboardSummary() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const negativeCount = await Feedback.countDocuments({
      isNegative: true,
      timestamp: { $gte: oneDayAgo }
    });
    const recentGuestFeedback = await Feedback.find({
      source: "Guest",
      rating: { $exists: true },
      timestamp: { $gte: oneDayAgo }
    }).select("rating");
    let averageRating = "N/A";
    if (recentGuestFeedback.length > 0) {
      const sum = recentGuestFeedback.reduce(
        (acc, curr) => acc + curr.rating,
        0
      );
      averageRating = (sum / recentGuestFeedback.length).toFixed(1);
    }
    return `Recent Summary: ${negativeCount} negative feedback entries in last 24h. Recent average guest rating is ${averageRating}/5.`;
  } catch (error) {
    console.error("Error fetching dashboard summary for chat:", error);
    return "Could not retrieve current dashboard summary.";
  }
}

// --- POST /api/chat/message ---
/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Send a message to the chat API.
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat response received.
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Internal server error.
 */
router.post("/message", async (req, res) => {
  if (!GEMINI_API_KEY) {
    // Double-check key existence
    return res
      .status(503)
      .json({ error: "Chat service API key not configured." });
  }

  const rawUserInput = req.body.message;
  const sessionId = req.ip || "default-session";
  const userInput = sanitizeInput(rawUserInput);

  if (!userInput) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  // Retrieve or initialize history (still good practice even if not sent in this basic fetch)
  if (!chatHistoryStore[sessionId]) chatHistoryStore[sessionId] = [];
  const currentHistory = chatHistoryStore[sessionId];

  try {
    // 1. Prepare Context and Prompt for the API
    const dashboardSummary = await getDashboardSummary();
    const systemPrompt = `You are HahuBot, a helpful assistant for the Habesha Hub Hotel... provide the live dashboard data given below. Live Dashboard Data: ${dashboardSummary}`;

    // Construct the simple prompt (system instructions + user input)
    // For basic fetch, sending the full prompt in one part is common.
    const fullPrompt = `${systemPrompt}\n\nUser: ${userInput}`;

    // Prepare the body according to the API documentation
    // Simple 'generateContent' often expects just the text directly within parts
    const requestBody = {
      contents: [
        {
          // Role can sometimes be omitted for simple prompts,
          // but good practice to include 'user' if possible/required
          // role: "user", // Optional based on specific API expectations
          parts: [{ text: fullPrompt }] // Sending combined prompt here
        }
      ],
      // Add generationConfig or safetySettings here if needed
      generationConfig: {
        maxOutputTokens: 250, // Increased slightly maybe
        temperature: 0.7
        // topP, topK etc.
      },
      safetySettings: [
        // Example safety settings
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    // 2. Make the Fetch Request
    console.log(`Sending fetch request to: ${API_ENDPOINT}`); // Log endpoint for debugging
    const fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    };

    const apiResponse = await fetch(API_ENDPOINT, fetchOptions);

    // 3. Handle the Response
    if (!apiResponse.ok) {
      // If response status is not 2xx, handle error
      const errorBody = await apiResponse.json().catch(() => ({})); // Try parsing error JSON, fallback to empty obj
      console.error(
        `Google AI API Error ${apiResponse.status}:`,
        JSON.stringify(errorBody, null, 2)
      );
      // Extract more specific error message if available
      const detail = errorBody?.error?.message || apiResponse.statusText;
      let userMessage = `Sorry, the AI service returned an error (${apiResponse.status}).`;
      if (apiResponse.status === 400)
        userMessage = "Sorry, there was an issue with the request format.";
      if (apiResponse.status === 429)
        userMessage =
          "Sorry, the chat service is busy. Please try again shortly.";
      if (apiResponse.status === 404)
        userMessage = "Sorry, the requested AI model was not found."; // Could happen if MODEL_NAME is bad
      if (errorBody?.error?.details?.some((d) => d.reason === "SAFETY")) {
        // Check detailed safety block
        userMessage =
          "Sorry, the request or response was blocked for safety reasons.";
      } else if (errorBody?.error?.message?.includes("SAFETY")) {
        // Check general safety message
        userMessage =
          "Sorry, the request or response was blocked for safety reasons.";
      }

      // Throw an error to be caught by the main catch block
      throw new Error(userMessage);
    }

    // Parse successful response JSON
    const responseData = await apiResponse.json();

    // 4. Extract Text (Crucial: Structure depends on Google's Response)
    // Inspect the 'responseData' object carefully (console.log it). Common paths:
    // - responseData.candidates[0].content.parts[0].text
    let botText = "";
    if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) {
      botText = responseData.candidates[0].content.parts[0].text;
    } else {
      console.error(
        "Could not extract text from AI response structure:",
        JSON.stringify(responseData, null, 2)
      );
      throw new Error("Received an unexpected response format from the AI.");
    }

    console.log("AI Response Text:", botText);

    // 5. Update Chat History (Conceptual)
    currentHistory.push({ role: "user", text: userInput });
    currentHistory.push({ role: "model", text: botText });
    if (currentHistory.length > MAX_HISTORY_LENGTH * 2) {
      chatHistoryStore[sessionId] = currentHistory.slice(
        -MAX_HISTORY_LENGTH * 2
      );
    }

    // 6. Send Reply to Frontend
    res.json({ reply: botText });
  } catch (error) {
    // Catch errors from fetch itself (network error) or thrown errors from response handling
    console.error("Error in chat API handler:", error);
    // Send back the message from the thrown error or a generic one
    res.status(500).json({
      error:
        error.message ||
        "Sorry, I encountered an unexpected error. Please try again later."
    });
  }
});

module.exports = router;
