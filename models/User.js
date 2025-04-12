const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // In production, store a hashed password!
  role: { type: String, enum: ['admin', 'staff'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
