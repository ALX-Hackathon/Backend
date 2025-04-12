# Habesha Hospitality Hub Backend

This is the backend API for the Habesha Hospitality Hub project. It is built with [Express](https://expressjs.com/), [MongoDB](https://www.mongodb.com/), and [Mongoose](https://mongoosejs.com/). The project includes endpoints for handling guest and staff feedback as well as a chat interface powered by Google’s Gemini API.

## Prerequisites

- Node.js (v14+ recommended)
- MongoDB instance (local or cloud)
- Environment variables set in a `.env` file (see below)

## Installation

1. Clone the repository.
2. Install dependencies:

    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory with the following required variables:

    ```
    PORT=3001
    HOST=0.0.0.0
    MONGO_URI=your_mongodb_connection_string
    TWILIO_ACCOUNT_SID=your_twilio_account_sid
    TWILIO_AUTH_TOKEN=your_twilio_auth_token
    TWILIO_PHONE_NUMBER=your_twilio_phone_number
    ALERT_PHONE_NUMBER=the_alert_recipient_phone_number
    GEMINI_API_KEY=your_google_gemini_api_key
    ```

## Project Structure

```
.
├── .env
├── .gitignore
├── package.json
├── server.js
├── config
│   └── db.js
├── models
│   └── Feedback.js
└── routes
    ├── chat.js
    └── feedback.js
```

- **server.js** – Sets up the Express server, middleware, routes, and Swagger documentation.
- **config/db.js** – Establishes a MongoDB connection.
- **models/Feedback.js** – Mongoose schema for feedback entries.
- **routes/feedback.js** – Handles guest and staff feedback endpoints.
- **routes/chat.js** – Provides chat functionalities powered by Google’s Gemini API.
- **.gitignore** – Lists files and directories to be ignored by Git.

## Running the App

For development with auto-reloading:

```sh
npm run dev
```

For production:

```sh
npm run start
```

The server will start at the host and port specified in your `.env` file (default is `http://0.0.0.0:3001`).

## API Documentation

Swagger API docs are available at the `/docs` endpoint once the server is running. Open your browser and visit:

```
http://<HOST>:<PORT>/docs
```

## Endpoints Overview

- **Feedback Endpoints**

  - `POST /api/feedback/guest` – Submit guest feedback.
  - `POST /api/feedback/staff` – Submit staff feedback.
  - `GET /api/feedback` – Retrieve all feedback logs.
  - `GET /api/feedback/validate-token` – Validate a feedback token.
  - `POST /api/feedback/contextual` – Submit detailed contextual feedback.

- **Chat Endpoint**

  - `POST /api/chat/message` – Send a message to the chat API and receive a response.

## Additional Notes

- Ensure you have valid credentials for Twilio and the Gemini API to enable SMS alerts and chat functionalities.
- Logs are handled with [morgan](https://github.com/expressjs/morgan).
- CORS is enabled for all origins (adjust for production).