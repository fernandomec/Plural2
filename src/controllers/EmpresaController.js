const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { handleApiError } = require('../utils/errorHandler');
const sharp = require('sharp');

/**
 * Listar empresas (view)
 */
exports.listarEmpresas = async (req, res) => {
    try {
        const filtroRazaoSocial = req.query.razaoSocial;
        const filtroCNPJ = req.query.cnpj;
        
        // Construir o objeto de filtro
        const where = {};
        
        if (filtroRazaoSocial) {
            where.razaoSocial = {
                contains: filtroRazaoSocial,
                mode: 'insensitive'
            };
        }
        
        if (filtroCNPJ) {
            where.cnpj = {
                contains: filtroCNPJ
            };
        }
        
        const empresas = await prisma.empresa.findMany({
            where,
            include: {
                bannerImagem: true,
                categorias: true,
                products: true,
                pedidos: true
            },
            orderBy: {
                razaoSocial: 'asc'
            }
        });
        
        res.render('admin', {
            user: req.user,
            empresas,
            totalEmpresas: empresas.length,
            pageContent: 'empresas'
        });
    } catch (error) {
        console.error('Erro ao carregar página de empresas:', error);
        res.status(500).send('Erro ao carregar página de empresas: ' + error.message);
    }
};

/**
 * Listar empresas (API)
 */
exports.listarEmpresasAPI = async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany();
        res.json(empresas);
    } catch (error) {
        handleApiError(res, error, 'Erro ao listar empresas');
    }
};

/**
 * Exibe formulário de criação de empresa
 */
exports.getFormCriarEmpresa = async (req, res) => {
    try {
        res.render('admin', {
            user: req.user,
            pageContent: 'create-empresa',
            pageTitle: 'Criar Nova Empresa'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de criação de empresa:', error);
        res.status(500).send('Erro ao carregar formulário de criação de empresa: ' + error.message);
    }
};

/**
 * Exibe formulário de edição de empresa
 */
exports.getFormEditarEmpresa = async (req, res) => {
    try {
        const { id } = req.params;
        
        const empresa = await prisma.empresa.findUnique({
            where: { id: parseInt(id) },
            include: {
                bannerImagem: true,
                categorias: true,
                products: true,
                pedidos: true
            }
        });
        
        if (!empresa) {
            return res.status(404).send('Empresa não encontrada');
        }
        
        res.render('admin', {
            user: req.user,
            empresa,
            pageContent: 'edit-empresa',
            pageTitle: 'Editar Empresa'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de empresa:', error);
        res.status(500).send('Erro ao carregar formulário de edição de empresa: ' + error.message);
    }
};

/**
 * Criar nova empresa
 */
exports.criarEmpresa = async (req, res) => {
    try {
        const { razaoSocial, email, password, cnpj, telefone, sobre } = req.body;

        // Validações básicas
        if (!razaoSocial || !email || !password || !cnpj || !telefone || !sobre) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos obrigatórios devem ser preenchidos'
            });
        }

        // Verificar se já existe uma empresa com o mesmo CNPJ ou e-mail
        const empresaExistente = await prisma.empresa.findFirst({
            where: {
                OR: [
                    { cnpj },
                    { email }
                ]
            }
        });

        if (empresaExistente) {
            const campoExistente = empresaExistente.cnpj === cnpj ? 'CNPJ' : 'E-mail';
            return res.status(400).json({
                success: false,
                message: `${campoExistente} já cadastrado`
            });
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Processar imagem, se houver
        let bannerImagemId = null;
        if (req.file) {
            let buffer, mimeType;
            if (req.file.mimetype === 'image/png') {
                buffer = await sharp(req.file.buffer)
                    .png({ quality: 80, compressionLevel: 8 })
                    .toBuffer();
                mimeType = 'image/png';
            } else {
                buffer = await sharp(req.file.buffer)
                    .jpeg({ quality: 80 })
                    .toBuffer();
                mimeType = 'image/jpeg';
            }

            const imagem = await prisma.imagem.create({
                data: {
                    data: buffer,
                    mimeType
                }
            });
            bannerImagemId = imagem.id;
        }

        // Criar a empresa
        const empresa = await prisma.empresa.create({
            data: {
                razaoSocial,
                email,
                password: hashedPassword,
                cnpj,
                telefone,
                sobre,
                bannerId: bannerImagemId
            }
        });

        res.status(201).json({
            success: true,
            message: 'Empresa criada com sucesso!',
            empresa
        });
    } catch (error) {
        // Verificar se é um erro de unique constraint no email ou cnpj
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            let message = 'Erro de duplicação de dados.';
            
            if (field === 'email') {
                message = 'Este email já está cadastrado para outra empresa.';
            } else if (field === 'cnpj') {
                message = 'Este CNPJ já está cadastrado para outra empresa.';
            }
            
            return res.status(400).json({
                success: false,
                message
            });
        }
        
        handleApiError(res, error, 'Erro ao criar empresa');
    }
};

/**
 * Atualizar empresa existente
 */
exports.atualizarEmpresa = async (req, res) => {
    try {
        const { id } = req.params;
        const { razaoSocial, email, password, cnpj, telefone, sobre } = req.body;
        const empresaId = parseInt(id);

        // Validações básicas
        if (!razaoSocial || !email || !cnpj || !telefone || !sobre) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos obrigatórios devem ser preenchidos'
            });
        }

        // Primeiro, obtemos a empresa atual
        const currentEmpresa = await prisma.empresa.findUnique({
            where: { id: empresaId }
        });

        if (!currentEmpresa) {
            return res.status(404).json({
                success: false,
                message: 'Empresa não encontrada'
            });
        }

        // Verificar se existe OUTRA empresa com o mesmo email ou CNPJ
        const empresaExistente = await prisma.empresa.findFirst({
            where: {
                OR: [
                    { email, id: { not: empresaId } },
                    { cnpj, id: { not: empresaId } }
                ]
            }
        });

        if (empresaExistente) {
            const campoExistente = empresaExistente.cnpj === cnpj ? 'CNPJ' : 'E-mail';
            return res.status(400).json({
                success: false,
                message: `${campoExistente} já cadastrado em outra empresa`
            });
        }

        // Preparar dados para atualização
        const updateData = {
            razaoSocial,
            email,
            cnpj,
            telefone,
            sobre
        };

        // Se houver nova senha, fazer hash e incluir nos dados de atualização
        if (password) {
            // Salvar a senha atual para histórico
            await prisma.pastPassword.create({
                data: {
                    password: currentEmpresa.password,
                    empresaId: empresaId,
                    createdAt: new Date()
                }
            });

            // Hash da nova senha
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Processar imagem, se houver
        if (req.file) {
            let buffer, mimeType;
            if (req.file.mimetype === 'image/png') {
                buffer = await sharp(req.file.buffer)
                    .png({ quality: 80, compressionLevel: 8 })
                    .toBuffer();
                mimeType = 'image/png';
            } else {
                buffer = await sharp(req.file.buffer)
                    .jpeg({ quality: 80 })
                    .toBuffer();
                mimeType = 'image/jpeg';
            }

            const imagem = await prisma.imagem.create({
                data: {
                    data: buffer,
                    mimeType
                }
            });
            updateData.bannerId = imagem.id;
        }

        // Atualizar a empresa
        const empresa = await prisma.empresa.update({
            where: { id: empresaId },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: 'Empresa atualizada com sucesso!',
            empresa
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao atualizar empresa');
    }
};

/**
 * Excluir empresa
 */
exports.excluirEmpresa = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se a empresa existe
        const empresa = await prisma.empresa.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!empresa) {
            return res.status(404).json({
                success: false,
                message: 'Empresa não encontrada'
            });
        }
        
        // Excluir empresa (as relações serão excluídas em cascata conforme definido no schema)
        await prisma.empresa.delete({
            where: { id: parseInt(id) }
        });
        
        res.json({
            success: true,
            message: 'Empresa excluída com sucesso!'
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao excluir empresa');
    }
};

/**
 * Excluir imagem de empresa
 */
exports.excluirImagemEmpresa = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar a imagem
        const imagem = await prisma.imagem.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!imagem) {
            return res.status(404).json({
                success: false,
                message: 'Imagem não encontrada'
            });
        }
        
        // Buscar empresa que usa esta imagem
        const empresa = await prisma.empresa.findFirst({
            where: { bannerId: parseInt(id) }
        });
        
        if (empresa) {
            // Remover referência da imagem na empresa
            await prisma.empresa.update({
                where: { id: empresa.id },
                data: { bannerId: null }
            });
        }
        
        // Excluir a imagem do banco de dados
        await prisma.imagem.delete({
            where: { id: parseInt(id) }
        });
        
        res.json({
            success: true,
            message: 'Imagem removida com sucesso!'
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao excluir imagem');
    }
};

/**
 * Verificar se um email já está em uso
 */
exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'E-mail não fornecido'
            });
        }
        
        // Verificar se existe uma empresa com este email
        const empresaExistente = await prisma.empresa.findUnique({
            where: { email }
        });
        
        res.json({
            success: true,
            exists: !!empresaExistente
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao verificar email');
    }
};
