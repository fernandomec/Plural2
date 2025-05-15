const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roles');
const { uploadMiddleware } = require('../middleware/upload');

// Importar controllers
const dashboardController = require('../controllers/DashboardController');
const produtoController = require('../controllers/ProdutoController');
const empresaController = require('../controllers/EmpresaController');
const categoriaController = require('../controllers/CategoriaController');
const usuarioController = require('../controllers/UsuarioController');
const pedidoController = require('../controllers/pedido.controller');
const freteEmpresaController = require('../controllers/FreteEmpresaController'); // Adicione esta linha

// Dashboard routes
router.get('/', authenticate, checkRole('ADMIN'), dashboardController.getDashboard);
router.get('/dashboard-data', authenticate, checkRole('ADMIN'), dashboardController.getDashboardData);
router.get('/dashboard-stats', authenticate, checkRole('ADMIN'), dashboardController.getDashboardStats);
router.get('/pedidos-por-status', authenticate, checkRole('ADMIN'), dashboardController.getPedidosPorStatus);

// Produto routes
router.get('/produtos', authenticate, checkRole('ADMIN'), produtoController.listarProdutos);
router.get('/produto/criar', authenticate, checkRole('ADMIN'), produtoController.getFormCriarProduto);
router.get('/produto/editar/:id', authenticate, checkRole('ADMIN'), produtoController.getFormEditarProduto);
router.post('/produto', authenticate, checkRole('ADMIN'), uploadMiddleware.single('produtoImagem'), produtoController.criarProduto);
router.put('/produto/:id', authenticate, checkRole('ADMIN'), uploadMiddleware.single('produtoImagem'), produtoController.atualizarProduto);
router.delete('/produto/:id', authenticate, checkRole('ADMIN'), produtoController.excluirProduto);

// Empresa routes
router.get('/empresas', authenticate, checkRole('ADMIN'), empresaController.listarEmpresas);
router.get('/api/empresas', authenticate, checkRole('ADMIN'), empresaController.listarEmpresasAPI);
router.get('/empresa/criar', authenticate, checkRole('ADMIN'), empresaController.getFormCriarEmpresa);
router.get('/empresa/editar/:id', authenticate, checkRole('ADMIN'), empresaController.getFormEditarEmpresa);
router.post('/empresa', authenticate, checkRole('ADMIN'), uploadMiddleware.single('bannerImagem'), empresaController.criarEmpresa);
router.put('/empresa/:id', authenticate, checkRole('ADMIN'), uploadMiddleware.single('bannerImagem'), empresaController.atualizarEmpresa);
router.delete('/empresa/:id', authenticate, checkRole('ADMIN'), empresaController.excluirEmpresa);
router.delete('/empresa/imagem/:id', authenticate, checkRole('ADMIN'), empresaController.excluirImagemEmpresa);
router.get('/check-email', authenticate, checkRole('ADMIN'), empresaController.checkEmail);

// Categoria routes
router.get('/categorias', authenticate, checkRole('ADMIN'), categoriaController.listarCategorias);
router.get('/categorias/:empresaId', authenticate, checkRole('ADMIN'), categoriaController.getCategoriasPorEmpresa);
router.get('/categoria/criar', authenticate, checkRole('ADMIN'), categoriaController.getFormCriarCategoria);
router.get('/categoria/editar/:id', authenticate, checkRole('ADMIN'), categoriaController.getFormEditarCategoria);
router.post('/categoria', authenticate, checkRole('ADMIN'), categoriaController.criarCategoria);
router.put('/categoria/:id', authenticate, checkRole('ADMIN'), categoriaController.atualizarCategoria);
router.delete('/categoria/:id', authenticate, checkRole('ADMIN'), categoriaController.excluirCategoria);

// Usuario routes
router.get('/usuarios', authenticate, checkRole('ADMIN'), usuarioController.listarUsuarios);
router.get('/usuario/editar/:id', authenticate, checkRole('ADMIN'), usuarioController.getFormEditarUsuario);
router.put('/usuario/:id', authenticate, checkRole('ADMIN'), usuarioController.atualizarUsuario);
router.delete('/usuario/:id', authenticate, checkRole('ADMIN'), usuarioController.excluirUsuario);

// Pedido routes
router.get('/pedidos', authenticate, checkRole('ADMIN'), pedidoController.listarPedidos);
router.get('/pedido/editar/:id', authenticate, checkRole('ADMIN'), pedidoController.getFormEditarPedido);
router.put('/pedido/:id/status', authenticate, checkRole('ADMIN'), pedidoController.atualizarStatusPedido);

// Frete Empresa routes
router.get('/frete-empresa', authenticate, checkRole('ADMIN'), freteEmpresaController.getFormFreteEmpresa);
router.post('/frete-empresa', authenticate, checkRole('ADMIN'), freteEmpresaController.cadastrarFreteEmpresa);

module.exports = router;
