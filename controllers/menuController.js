/**
 * QORTA Backend - Menu Controller
 * Handles menu item and category operations
 */

const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');

// ================== MENU ITEMS ==================

// Get all menu items for tenant
const getMenuItems = async (req, res, next) => {
    try {
        const { category, includeUnavailable } = req.query;
        const options = {};
        if (category) options.category = category;
        if (includeUnavailable === 'true' && req.user) options.includeUnavailable = true;

        const items = await MenuItem.findByTenant(req.tenant.id, options);

        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        next(error);
    }
};

// Get featured items
const getFeaturedItems = async (req, res, next) => {
    try {
        const items = await MenuItem.findFeatured(req.tenant.id);

        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        next(error);
    }
};

// Get single menu item
const getMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const item = await MenuItem.findById(id);

        if (!item || item.tenantId !== req.tenant.id) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found'
            });
        }

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        next(error);
    }
};

// Create menu item (admin)
const createMenuItem = async (req, res, next) => {
    try {
        const itemData = {
            ...req.body,
            tenantId: req.tenant.id
        };

        const item = await MenuItem.create(itemData);

        res.status(201).json({
            success: true,
            data: item
        });
    } catch (error) {
        next(error);
    }
};

// Update menu item (admin)
const updateMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await MenuItem.findById(id);

        if (!existing || existing.tenantId !== req.tenant.id) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found'
            });
        }

        const item = await MenuItem.update(id, req.body);

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        next(error);
    }
};

// Delete menu item (admin)
const deleteMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await MenuItem.findById(id);

        if (!existing || existing.tenantId !== req.tenant.id) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found'
            });
        }

        await MenuItem.delete(id);

        res.json({
            success: true,
            message: 'Menu item deleted'
        });
    } catch (error) {
        next(error);
    }
};

// ================== CATEGORIES ==================

// Get all categories
const getCategories = async (req, res, next) => {
    try {
        const categories = await Category.findByTenant(req.tenant.id);

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

// Create category (admin)
const createCategory = async (req, res, next) => {
    try {
        const categoryData = {
            ...req.body,
            tenantId: req.tenant.id
        };

        const category = await Category.create(categoryData);

        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

// Update category (admin)
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { getDb, COLLECTIONS } = require('../config/firebase');
        const doc = await getDb().collection(COLLECTIONS.CATEGORIES).doc(id).get();
        if (!doc.exists || doc.data().tenantId !== req.tenant.id) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        const category = await Category.update(id, req.body);

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

// Delete category (admin)
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { getDb, COLLECTIONS } = require('../config/firebase');
        const doc = await getDb().collection(COLLECTIONS.CATEGORIES).doc(id).get();
        if (!doc.exists || doc.data().tenantId !== req.tenant.id) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        await Category.delete(id);

        res.json({
            success: true,
            message: 'Category deleted'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMenuItems,
    getFeaturedItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
