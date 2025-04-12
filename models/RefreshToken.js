const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expires: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
