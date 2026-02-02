/**
 * QORTA Backend - Category Routes
 * Tenant-scoped routes for menu categories
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const { auth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/menuController');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// ================== PUBLIC ROUTES ==================

// Get all categories
router.get('/', getCategories);

// ================== ADMIN ROUTES (PROTECTED) ==================

// Create category (admin)
router.post('/', auth, validateRequest(['name']), createCategory);

// Update category (admin)
router.put('/:id', auth, updateCategory);

// Delete category (admin)
router.delete('/:id', auth, deleteCategory);

module.exports = router;
