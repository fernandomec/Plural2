const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { processProductData } = require('../utils/productUtils');

// Get all products with optional filtering
exports.getAllProducts = async (req, res) => {
    try {
        console.log('Parâmetros de filtro recebidos:', req.query);
        
        // Construir where clause para filtragem
        const where = {};
        
        // Filtrar por empresa
        if (req.query.empresa && req.query.empresa !== '') {
            where.empresaId = parseInt(req.query.empresa);
        }
        
        // Filtrar por categoria
        if (req.query.categoria && req.query.categoria !== '') {
            where.categoryId = parseInt(req.query.categoria);
        }
        
        // Filtrar por status de promoção
        if (req.query.promo !== undefined && req.query.promo !== '') {
            // Converter string 'true'/'false' para boolean
            where.boolPromo = req.query.promo === 'true';
        }
        
        console.log('Aplicando filtro com where clause:', where);
        
        // Buscar produtos com filtros
        const produtos = await prisma.product.findMany({
            where,
            include: {
                empresa: true,
                category: true,
                images: true
            },
            orderBy: { id: 'desc' }
        });
        
        // Contar total de produtos com filtro
        const totalProdutos = await prisma.product.count({ where });
        
        // Buscar todas empresas para dropdown
        const empresas = await prisma.empresa.findMany({
            orderBy: { razaoSocial: 'asc' }
        });
        
        // Buscar todas categorias para dropdown com info de empresa
        const categorias = await prisma.category.findMany({
            orderBy: { name: 'asc' },
            include: { empresa: true }
        });
        
        console.log(`Encontrados ${produtos.length} produtos com os filtros aplicados`);
        
        res.render('admin', {
            user: req.user,
            produtos,
            totalProdutos,
            empresas,
            categorias,
            filtros: {
                empresa: req.query.empresa || '',
                categoria: req.query.categoria || '',
                promo: req.query.promo || ''
            },
            pageContent: 'product'
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).render('error', {
            message: 'Erro ao buscar produtos',
            error: error.message
        });
    }
};

// Método para obter formulário de criação de produto
exports.getCreateProductForm = async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({
            orderBy: { razaoSocial: 'asc' }
        });
        
        res.render('admin', {
            user: req.user,
            empresas,
            pageContent: 'create-product',
            pageTitle: 'Criar Novo Produto'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de criação:', error);
        res.status(500).send('Erro ao carregar formulário: ' + error.message);
    }
};

// Método para obter formulário de edição de produto
exports.getEditProductForm = async (req, res) => {
    try {
        const { id } = req.params;
        
        const produto = await prisma.product.findUnique({
            where: { id: parseInt(id) },
            include: {
                images: true,
                empresa: true,
                category: true
            }
        });
        
        if (!produto) {
            return res.status(404).send('Produto não encontrado');
        }
        
        const empresas = await prisma.empresa.findMany({
            orderBy: { razaoSocial: 'asc' }
        });
        
        const categorias = await prisma.category.findMany({
            where: { empresaId: produto.empresaId },
            orderBy: { name: 'asc' }
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
        console.error('Erro ao carregar formulário de edição:', error);
        res.status(500).send('Erro ao carregar formulário: ' + error.message);
    }
};

// Outros métodos necessários para sua API
