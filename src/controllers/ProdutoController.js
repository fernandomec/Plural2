const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleApiError } = require('../utils/errorHandler');
const sharp = require('sharp');

/**
 * Listar produtos (view)
 */
exports.listarProdutos = async (req, res) => {
    try {
        // --- INÍCIO DO FILTRO CORRETO ---
        const filtros = {
            empresa: req.query.empresa || '',
            categoria: req.query.categoria || '',
            promo: req.query.promo || ''
        };
        const where = {};
        if (filtros.empresa) {
            where.empresaId = parseInt(filtros.empresa);
        }
        if (filtros.categoria) {
            where.categoryId = parseInt(filtros.categoria);
        }
        if (filtros.promo !== '') {
            where.boolPromo = filtros.promo === 'true';
        }
        // --- FIM DO FILTRO CORRETO ---

        const produtos = await prisma.product.findMany({
            where,
            include: {
                empresa: true,
                category: true,
                images: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        const empresas = await prisma.empresa.findMany();
        const categorias = await prisma.category.findMany({
            include: {
                empresa: true
            }
        });
        
        res.render('admin', { 
            user: req.user,
            produtos,
            empresas,
            categorias,
            totalProdutos: produtos.length,
            filtros, // <-- Passa os filtros para o template
            pageContent: 'product'
        });
    } catch (error) {
        console.error('Erro ao carregar página de produtos:', error);
        res.status(500).send('Erro ao carregar página de produtos: ' + error.message);
    }
};

/**
 * Exibe formulário de criação de produto
 */
exports.getFormCriarProduto = async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany();
        const categorias = await prisma.category.findMany({
            include: { empresa: true }
        });
        
        res.render('admin', { 
            user: req.user,
            empresas,
            categorias,
            pageContent: 'create-product',
            pageTitle: 'Criar Novo Produto'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de criação de produto:', error);
        res.status(500).send('Erro ao carregar formulário de criação de produto: ' + error.message);
    }
};

/**
 * Exibe formulário de edição de produto
 */
exports.getFormEditarProduto = async (req, res) => {
    try {
        const { id } = req.params;
        
        const produto = await prisma.product.findUnique({
            where: { id: parseInt(id) },
            include: {
                empresa: true,
                category: true,
                images: true
            }
        });
        
        if (!produto) {
            return res.status(404).send('Produto não encontrado');
        }
        
        const empresas = await prisma.empresa.findMany();
        
        const categorias = await prisma.category.findMany({
            where: { empresaId: produto.empresaId },
            include: { empresa: true }
        });
        
        res.render('admin', { 
            user: req.user,
            produto,
            empresas,
            categorias,
            pageContent: 'edit-product',
            pageTitle: 'Editar Produto'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de produto:', error);
        res.status(500).send('Erro ao carregar formulário de edição de produto: ' + error.message);
    }
};

/**
 * Criar novo produto
 */
exports.criarProduto = async (req, res) => {
    try {
        const {
            name,
            categoryId,
            descricao,
            preco,
            boolPromo,
            desconto,
            estoque,
            codBarra,
            empresaId
        } = req.body;

        // Validações básicas
        if (!name || !categoryId || !preco || !estoque || !empresaId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Campos obrigatórios não preenchidos'
            });
        }

        // Processar imagem, se houver
        let imagemData = null;
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

            imagemData = await prisma.imagem.create({
                data: {
                    data: buffer,
                    mimeType
                }
            });
        }

        // Criar produto
        const produto = await prisma.product.create({
            data: {
                name,
                categoryId: parseInt(categoryId),
                descricao,
                preco: parseFloat(preco),
                boolPromo: boolPromo === 'true' || boolPromo === 'on',
                desconto: desconto && (boolPromo === 'true' || boolPromo === 'on') ? parseInt(desconto) : null,
                estoque: parseInt(estoque),
                codBarra,
                empresaId: parseInt(empresaId),
                userId: req.user.id
            }
        });

        // Se houver imagem, associá-la ao produto
        if (imagemData) {
            await prisma.imagem.update({
                where: { id: imagemData.id },
                data: { productId: produto.id }
            });
        }

        res.status(201).json({ 
            success: true, 
            message: 'Produto criado com sucesso!',
            produto: produto
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao criar produto');
    }
};

/**
 * Atualizar produto existente
 */
exports.atualizarProduto = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            categoryId,
            descricao,
            preco,
            boolPromo,
            desconto,
            estoque,
            codBarra,
            empresaId
        } = req.body;

        // Validações básicas
        if (!name || !categoryId || !preco || !estoque || !empresaId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Campos obrigatórios não preenchidos'
            });
        }

        // Processar imagem, se houver
        let imagemData = null;
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

            imagemData = await prisma.imagem.create({
                data: {
                    data: buffer,
                    mimeType,
                    productId: parseInt(id)
                }
            });
        }

        // Atualizar produto
        const produto = await prisma.product.update({
            where: { id: parseInt(id) },
            data: {
                name,
                categoryId: parseInt(categoryId),
                descricao,
                preco: parseFloat(preco),
                boolPromo: boolPromo === 'true' || boolPromo === 'on',
                desconto: desconto && (boolPromo === 'true' || boolPromo === 'on') ? parseInt(desconto) : null,
                estoque: parseInt(estoque),
                codBarra,
                empresaId: parseInt(empresaId)
            }
        });

        res.status(200).json({ 
            success: true, 
            message: 'Produto atualizado com sucesso!',
            produto: produto
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao atualizar produto');
    }
};

/**
 * Excluir produto
 */
exports.excluirProduto = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se o produto existe
        const produto = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Excluir produto
        await prisma.product.delete({
            where: { id: parseInt(id) }
        });
        
        res.json({
            success: true,
            message: 'Produto excluído com sucesso!'
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao excluir produto');
    }
};
