const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const piattaformaController = require('../controllers/piattaformaController');

const requireSuperuser = require('../middleware/requireSuperuser');

const router = express.Router();

// Solo immagini raster/ico: niente SVG, che servito dalla stessa origine
// dell'app potrebbe contenere script.
const ALLOWED_MIME = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
};

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = '/app/uploads';
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        // Nome casuale + estensione derivata dal MIME (mai dal nome originale)
        filename: (req, file, cb) => {
            cb(null, `piattaforma-${req.params.tipo}-${crypto.randomBytes(8).toString('hex')}${ALLOWED_MIME[file.mimetype]}`);
        },
    }),
    limits: { fileSize: 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
        cb(new Error('Formato non supportato: usa PNG, JPG, WEBP o ICO'));
    },
});

const validTipo = (req, res, next) => {
    if (req.params.tipo !== 'logo' && req.params.tipo !== 'favicon') return res.sendStatus(404);
    next();
};

const handleUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File troppo grande (massimo 1 MB)' : err.message;
        return res.status(400).json({ error: msg });
    });
};

// Montato su /piattaforma dopo authenticateToken
router.use(requireSuperuser);
router.get('/', piattaformaController.getPrivate);
router.put('/', piattaformaController.update);
router.post('/:tipo', validTipo, handleUpload, piattaformaController.uploadAsset);
router.delete('/:tipo', validTipo, piattaformaController.deleteAsset);

module.exports = router;
