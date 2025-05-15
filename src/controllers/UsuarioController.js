const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Listar usuários (view)
 */
exports.listarUsuarios = async (req, res) => {
    try {
        const filtroEmail = req.query.email;
        const filtroUsername = req.query.username;
        const filtroRole = req.query.role;
        
        // Construir o objeto de filtro
        const where = {};
        
        if (filtroEmail) {
            where.email = {
                contains: filtroEmail,
                mode: 'insensitive'
            };
        }
        
        if (filtroUsername) {
            where.username = {
                contains: filtroUsername,
                mode: 'insensitive'
            };
        }
        
        if (filtroRole) {
            where.role = filtroRole;
        }
        
        const usuarios = await prisma.user.findMany({
            where,
            include: {
                pedidos: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        res.render('admin', {
            user: req.user,
            usuarios,
            totalUsuarios: usuarios.length,
            pageContent: 'usuarios'
        });
    } catch (error) {
        console.error('Erro ao carregar página de usuários:', error);
        res.status(500).send('Erro ao carregar página de usuários: ' + error.message);
    }
};

/**
 * Exibe formulário de edição de usuário
 */
exports.getFormEditarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        
        const usuario = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: {
                pedidos: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });
        
        if (!usuario) {
            return res.status(404).send('Usuário não encontrado');
        }
        
        res.render('admin', {
            user: req.user,
            usuario,
            pageContent: 'edit-user',
            pageTitle: 'Editar Usuário'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de usuário:', error);
        res.status(500).send('Erro ao carregar formulário de edição de usuário: ' + error.message);
    }
};

/**
 * Atualizar usuário existente
 */
exports.atualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role, password, tel, cep, endereco, enderecoComplemento, bairro } = req.body;

        // Validações básicas
        if (!username || !email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário, e-mail e função são obrigatórios'
            });
        }

        // Preparar dados para atualização
        const updateData = {
            username,
            email,
            role,
            tel,
            cep,
            endereco,
            enderecoComplemento,
            bairro
        };

        // Se houver nova senha, fazer hash e incluir nos dados de atualização
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        // Atualizar o usuário
        const usuario = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: 'Usuário atualizado com sucesso!',
            usuario
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao atualizar usuário');
    }
};

/**
 * Excluir usuário
 */
exports.excluirUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se o usuário existe
        const usuario = await prisma.user.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }
        
        // Impedir a exclusão do próprio usuário admin logado
        if (usuario.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Você não pode excluir seu próprio usuário'
            });
        }
        
        // Excluir usuário (as relações serão tratadas pelo Prisma conforme configurado no schema)
        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        
        res.json({
            success: true,
            message: 'Usuário excluído com sucesso!'
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao excluir usuário');
    }
};
