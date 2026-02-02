/**
 * QORTA Backend - Auth Routes
 * Token verification endpoint
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

/**
 * GET /api/:slug/auth/verify
 * Verify that the current token is valid
 */
router.get('/verify', auth, (req, res) => {
    res.json({
        success: true,
        user: {
            uid: req.user.uid,
            email: req.user.email
        }
    });
});

module.exports = router;
