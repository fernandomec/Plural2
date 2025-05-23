const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validatePassword = require('../utils/passwordValidator');
const { blacklist } = require('../middleware/auth');
const nodemailer = require('nodemailer');

module.exports = {
    async loginPage(req, res) {
        const token = req.cookies.auth_token;
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return res.redirect('/user');
            } catch (err) {
                res.clearCookie('auth_token');
            }
        }
        res.render('login', { user: null });
    },

    async registerPage(req, res) {
        const token = req.cookies.auth_token;
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return res.redirect('/user');
            } catch (err) {
                res.clearCookie('auth_token');
            }
        }
        res.render('register', { user: null });
    },

    async login(req, res) {
        try {
            const user = await prisma.user.findUnique({
                where: { email: req.body.email }
            });

            if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
                return res.status(401).json({
                    auth: false,
                    message: 'Email ou senha inválidos.'
                });
            }

            const token = jwt.sign(
                { email: user.email, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 86400000 //24h
            });

            return res.json({
                auth: true,
                token,
                user: { email: user.email, username: user.username }
            });
        } catch (error) {
            res.status(500).json({
                auth: false,
                message: 'Erro interno do servidor.'
            });
        }
    },

    async register(req, res) {
        try {
            const { email, username, password } = req.body;

            const passwordValidationResult = validatePassword(password);
            if (!passwordValidationResult.isValid) {
                return res.status(400).json({
                    success: false,
                    message: passwordValidationResult.message
                });
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email já está em uso.'
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.create({
                data: { email, username, password: hashedPassword }
            });

            res.status(201).json({
                success: true,
                message: 'Usuário criado com sucesso!'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao criar conta: ' + error.message
            });
        }
    },

    async logout(req, res) {
        try {
            const token = req.cookies.auth_token;
            if (token) {
                blacklist.push(token);
                res.clearCookie('auth_token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    path: '/'
                });
            }
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    async forgotPasswordPage(req, res) {
        res.render('forgot-password', { user: null, message: null, error: null });
    },

    async forgotPassword(req, res) {
        const { email } = req.body;
        try {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.render('forgot-password', { user: null, message: null, error: 'Usuário não encontrado.' });
            }
            const secret = process.env.JWT_SECRET + user.password;
            const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });
            const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${user.id}/${token}`;

            const transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                to: user.email,
                from: process.env.EMAIL_USER,
                subject: 'Redefinição de senha',
                text: `Você solicitou a redefinição de senha. Clique no link para redefinir: ${resetURL}`
            });

            res.render('forgot-password', { user: null, message: 'Link de redefinição enviado para seu email.', error: null });
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            res.render('forgot-password', { user: null, message: null, error: 'Erro ao enviar email. Tente novamente.' });
        }
    },

    async resetPasswordPage(req, res) {
        const { id, token } = req.params;
        res.render('reset-password', { user: null, id, token, error: null, message: null });
    },

    async resetPassword(req, res) {
        const { id, token } = req.params;
        const { password } = req.body;
        try {
            const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
            if (!user) {
                return res.render('reset-password', { user: null, id, token, error: 'Usuário não encontrado.', message: null });
            }
            const secret = process.env.JWT_SECRET + user.password;
            jwt.verify(token, secret);

            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });

            res.render('reset-password', { user: null, id, token: null, error: null, message: 'Senha redefinida com sucesso!' });
        } catch (error) {
            res.render('reset-password', { user: null, id, token, error: 'Token inválido ou expirado.', message: null });
        }
    },
};