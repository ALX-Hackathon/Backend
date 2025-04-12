const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, staff]
 *     responses:
 *       201:
 *         description: User registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 role:
 *                   type: string
 *       400:
 *         description: Bad Request. Username already exists or invalid role.
 */
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ message: "Username, password, and role are required." });
    }
    if (!['admin', 'staff'].includes(role)) {
        return res.status(400).json({ message: "Role must be either 'admin' or 'staff'." });
    }
    
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists." });
        }
        
        const newUser = new User({ username, password, role }); // In production, hash the password!
        const savedUser = await newUser.save();
        return res.status(201).json({ id: savedUser._id, username: savedUser.username, role: savedUser.role });
    } catch (error) {
        return res.status(500).json({ message: "Server error during registration." });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login returns a JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Unauthorized. Incorrect credentials.
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const foundUser = await User.findOne({ username, password }); // In production, compare hashed passwords!
        if (foundUser) {
            const payload = { id: foundUser._id, username: foundUser.username, role: foundUser.role };
            const token = jwt.sign(payload, process.env.JWT_SECRET || 'somesecret', { expiresIn: '1h' });
            return res.json({ token, role: foundUser.role });
        }
        return res.status(401).json({ message: "Invalid credentials" });
    } catch (error) {
        return res.status(500).json({ message: "Server error during login." });
    }
});

module.exports = router;
