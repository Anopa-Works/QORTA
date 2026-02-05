/**
 * QORTA Backend - Menu Routes
 * Tenant-scoped routes for menu and categories
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    getMenuItems,
    getFeaturedItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
} = require('../controllers/menuController');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// ================== PUBLIC ROUTES ==================

// Get all menu items (optionally filtered by category)
router.get('/', optionalAuth, getMenuItems);

// Get featured items
router.get('/featured', getFeaturedItems);

// Get single menu item
router.get('/:id', getMenuItem);

// ================== ADMIN ROUTES (PROTECTED) ==================

// Create menu item
router.post('/', auth, validateRequest(['name', 'price', 'category']), createMenuItem);

// Update menu item
router.put('/:id', auth, updateMenuItem);

// Delete menu item
router.delete('/:id', auth, deleteMenuItem);

module.exports = router;
