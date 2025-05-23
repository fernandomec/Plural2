const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/logout', AuthController.logout);
router.get('/forgot-password', AuthController.forgotPasswordPage);
router.post('/forgot-password', AuthController.forgotPassword);
router.get('/reset-password/:id/:token', AuthController.resetPasswordPage);
router.post('/reset-password/:id/:token', AuthController.resetPassword);

module.exports = router;