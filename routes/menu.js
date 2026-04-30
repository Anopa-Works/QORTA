/**
 * QORTA Backend - Menu Routes
 * Tenant-scoped routes for menu and categories
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const tenantResolver = require('../middleware/tenantResolver');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { getStorage } = require('../config/firebase');
const {
    getMenuItems,
    getFeaturedItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
} = require('../controllers/menuController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
        }
    }
});

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

// Upload menu item image → Firebase Storage, returns public URL
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No image provided' });

        const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '');
        const filename = `menu-images/${req.tenant.id}/${uuidv4()}.${ext}`;
        const bucket = getStorage();
        const file = bucket.file(filename);

        await file.save(req.file.buffer, {
            metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' }
        });
        await file.makePublic();

        res.json({ success: true, data: { url: `https://storage.googleapis.com/${bucket.name}/${filename}` } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to upload image' });
    }
});

// Create menu item
router.post('/', auth, validateRequest(['name', 'price', 'category']), createMenuItem);

// Update menu item
router.put('/:id', auth, updateMenuItem);

// Delete menu item
router.delete('/:id', auth, deleteMenuItem);

module.exports = router;
