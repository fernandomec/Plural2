const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController');
const empresaController = require('../controllers/empresaController');
const categoriaController = require('../controllers/categoriaController');
const produtoController = require('../controllers/produtoController');
const pedidoController = require('../controllers/pedidoController');
const { isAdmin, isEditorOrAdmin } = require('../middlewares/authMiddleware');

// Import the ProductController
const ProductController = require('../controllers/ProductController');

// Admin dashboard
router.get('/', isAdmin, adminController.dashboard);

// User management
router.get('/usuarios', isAdmin, userController.listarUsuarios);
router.get('/usuario/criar', isAdmin, userController.getFormCriarUsuario);
router.post('/usuario', isAdmin, userController.criarUsuario);
router.get('/usuario/editar/:id', isAdmin, userController.getFormEditarUsuario);
router.put('/usuario/:id', isAdmin, userController.atualizarUsuario);
router.delete('/usuario/:id', isAdmin, userController.excluirUsuario);

// Empresa management
router.get('/empresas', isAdmin, empresaController.listarEmpresas);
router.get('/empresa/criar', isAdmin, empresaController.getFormCriarEmpresa);
router.post('/empresa', isAdmin, empresaController.criarEmpresa);
router.get('/empresa/editar/:id', isAdmin, empresaController.getFormEditarEmpresa);
router.put('/empresa/:id', isAdmin, empresaController.atualizarEmpresa);
router.delete('/empresa/:id', isAdmin, empresaController.excluirEmpresa);

// Categoria management
router.get('/categorias', isAdmin, categoriaController.listarCategorias);
router.get('/categoria/criar', isAdmin, categoriaController.getFormCriarCategoria);
router.post('/categoria', isAdmin, categoriaController.criarCategoria);
router.get('/categoria/editar/:id', isAdmin, categoriaController.getFormEditarCategoria);
router.put('/categoria/:id', isAdmin, categoriaController.atualizarCategoria);
router.delete('/categoria/:id', isAdmin, categoriaController.excluirCategoria);

// Produto management
router.get('/produtos', isAdmin, produtoController.listarProdutos);
router.get('/produto/criar', isAdmin, produtoController.getFormCriarProduto);
router.post('/produto', isAdmin, produtoController.criarProduto);
router.get('/produto/editar/:id', isAdmin, produtoController.getFormEditarProduto);
router.put('/produto/:id', isAdmin, produtoController.atualizarProduto);
router.delete('/produto/:id', isAdmin, produtoController.excluirProduto);

// Pedido management
router.get('/pedidos', isAdmin, pedidoController.listarPedidos);
router.get('/pedido/:id', isAdmin, pedidoController.getPedidoById);
router.post('/pedido', isAdmin, pedidoController.criarPedido);
router.put('/pedido/:id', isAdmin, pedidoController.atualizarPedido);
router.delete('/pedido/:id', isAdmin, pedidoController.excluirPedido);

// Product routes
router.get('/produtos', async (req, res) => {
    try {
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
        res.status(500).render('admin', {
            user: req.user,
            error: 'Erro ao buscar produtos: ' + error.message,
            pageContent: 'error'
        });
    }
});
router.get('/produto/criar', ProductController.getCreateProductForm);
router.get('/produto/editar/:id', ProductController.getEditProductForm);


module.exports = router;