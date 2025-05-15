const multer = require('multer');

// Configuração do multer para usar memoryStorage e lidar com uploads de imagens
const storage = multer.memoryStorage();

const uploadMiddleware = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Apenas imagens (jpeg, jpg, png, gif) são aceitas.'));
        }
    }
});

module.exports = { uploadMiddleware };
