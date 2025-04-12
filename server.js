// server.js
require("dotenv").config(); // Load .env variables FIRST
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const feedbackRoutes = require("./routes/feedback");
const morgan = require("morgan"); // HTTP request logger middleware
const chatRoutes = require("./routes/chat"); // Import the chat routes
const authRoutes = require("./routes/auth.js")

// --- Swagger Dependencies ---
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const jwt = require("jsonwebtoken"); // Import JWT for authentication

const HOST = process.env.HOST || "0.0.0.0";
// Connect to Database
connectDB();

const app = express();

// --- Middleware ---
// Enable CORS for all origins (adjust for production later)
app.use(cors());
app.use(morgan("dev"));

// Body Parser Middleware (Express's built-in)
app.use(express.json()); // To handle JSON payloads
app.use(express.urlencoded({ extended: false })); // To handle URL-encoded payloads (optional)

// --- Routes ---
// Root route for testing

// Mount Feedback API routes
app.use("/api/feedback", feedbackRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes); // Mounting auth route


// --- Swagger Setup ---
// Define Swagger options for API documentation
const PORT = process.env.PORT || 3001; // Use port from .env or default

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Habesha Hospitality Hub API",
            version: "1.0.0",
            description: "API documentation for the Habesha Hospitality Hub"
        },
        servers: [
            {
                url: `https://backend-bhww.onrender.com/`
            },
            {
                url: `http://localhost:${PORT}/`
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
       
    },

    apis: ["./routes/*.js"] // Adjust path as needed where you add your route annotations
};

app.get("/", (req, res) => {
  res.send("Habesha Hospitality Hub API. Visit /docs for documentation.");
});

const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- Server Start ---
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
