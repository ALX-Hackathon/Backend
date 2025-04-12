// config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // Ensure dotenv is configured early

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Remove useCreateIndex and useFindAndModify if using Mongoose 6+
      // useCreateIndex: true, // Deprecated in Mongoose 6+
      // useFindAndModify: false, // Deprecated in Mongoose 6+
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;