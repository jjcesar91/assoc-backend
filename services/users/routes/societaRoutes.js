const express = require('express');
const router = express.Router();
const societaController = require('../controllers/societaController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/app/uploads'; // Shared volume path
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sanitize and preserve extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Routes for /api/societa
router.get('/', societaController.getAllSocieta);
router.post('/', societaController.createSocieta);
router.get('/:id', societaController.getSocietaById);
router.put('/:id', societaController.updateSocieta);
router.post('/:id/logo', upload.single('logo'), societaController.uploadLogo);

module.exports = router;
