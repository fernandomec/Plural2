const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleApiError } = require('../utils/errorHandler');

/**
 * Listar categorias (view)
 */
exports.listarCategorias = async (req, res) => {
    try {
        const filtroNome = req.query.nome;
        const filtroEmpresa = req.query.empresa;
        
        // Construir o objeto de filtro
        const where = {};
        
        if (filtroNome) {
            where.name = {
                contains: filtroNome,
                mode: 'insensitive'
            };
        }
        
        if (filtroEmpresa) {
            where.empresaId = parseInt(filtroEmpresa);
        }
        
        const categorias = await prisma.category.findMany({
            where,
            include: {
                empresa: true,
                products: true
            },
            orderBy: [
                { empresaId: 'asc' },
                { name: 'asc' }
            ]
        });
        
        const empresas = await prisma.empresa.findMany({
            orderBy: {
                razaoSocial: 'asc'
            }
        });
        
        // Estatísticas adicionais para o dashboard de categorias
        const totalProdutos = categorias.reduce((total, cat) => total + cat.products.length, 0);
        const categoriasVazias = categorias.filter(cat => cat.products.length === 0).length;
        
        // Agrupar categorias por empresa para visualização
        const categoriasPorEmpresa = empresas.map(empresa => {
            const cats = categorias.filter(cat => cat.empresaId === empresa.id);
            return {
                empresa: empresa.razaoSocial,
                empresaId: empresa.id,
                total: cats.length,
                categorias: cats
            };
        }).filter(grupo => grupo.total > 0);
        
        res.render('admin', {
            user: req.user,
            categorias,
            empresas,
            totalCategorias: categorias.length,
            totalProdutos,
            categoriasVazias,
            categoriasPorEmpresa,
            filtros: {
                nome: filtroNome || '',
                empresa: filtroEmpresa || ''
            },
            pageContent: 'categorias'
        });
    } catch (error) {
        console.error('Erro ao carregar página de categorias:', error);
        res.status(500).send('Erro ao carregar página de categorias: ' + error.message);
    }
};

/**
 * Obter categorias por empresa
 */
exports.getCategoriasPorEmpresa = async (req, res) => {
    try {
        const categorias = await prisma.category.findMany({
            where: {
                empresaId: parseInt(req.params.empresaId)
            }
        });
        res.json(categorias);
    } catch (error) {
        handleApiError(res, error, 'Erro ao buscar categorias');
    }
};

/**
 * Exibe formulário de criação de categoria
 */
exports.getFormCriarCategoria = async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({
            orderBy: {
                razaoSocial: 'asc'
            }
        });
        
        res.render('admin', {
            user: req.user,
            empresas,
            pageContent: 'create-category',
            pageTitle: 'Criar Nova Categoria'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de criação de categoria:', error);
        res.status(500).send('Erro ao carregar formulário de criação de categoria: ' + error.message);
    }
};

/**
 * Exibe formulário de edição de categoria
 */
exports.getFormEditarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        
        const categoria = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                empresa: true,
                products: true
            }
        });
        
        if (!categoria) {
            return res.status(404).send('Categoria não encontrada');
        }
        
        const empresas = await prisma.empresa.findMany({
            orderBy: {
                razaoSocial: 'asc'
            }
        });
        
        res.render('admin', {
            user: req.user,
            categoria,
            empresas,
            pageContent: 'edit-category',
            pageTitle: 'Editar Categoria'
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de categoria:', error);
        res.status(500).send('Erro ao carregar formulário de edição de categoria: ' + error.message);
    }
};

/**
 * Criar nova categoria
 */
exports.criarCategoria = async (req, res) => {
    try {
        const { name, empresaId } = req.body;
        
        // Validações básicas
        if (!name || !empresaId) {
            return res.status(400).json({
                success: false,
                message: 'Nome e empresa são obrigatórios'
            });
        }
        
        // Verificar se já existe uma categoria com o mesmo nome na mesma empresa
        const categoriaExistente = await prisma.category.findFirst({
            where: {
                name,
                empresaId: parseInt(empresaId)
            }
        });
        
        if (categoriaExistente) {
            return res.status(400).json({
                success: false,
                message: 'Já existe uma categoria com este nome para esta empresa'
            });
        }
        
        // Criar categoria
        const categoria = await prisma.category.create({
            data: {
                name,
                empresaId: parseInt(empresaId)
            }
        });
        
        res.status(201).json({
            success: true,
            message: 'Categoria criada com sucesso!',
            categoria
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao criar categoria');
    }
};

/**
 * Atualizar categoria existente
 */
exports.atualizarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, empresaId } = req.body;
        
        // Validações básicas
        if (!name || !empresaId) {
            return res.status(400).json({
                success: false,
                message: 'Nome e empresa são obrigatórios'
            });
        }
        
        // Verificar se já existe outra categoria com o mesmo nome na mesma empresa
        const categoriaExistente = await prisma.category.findFirst({
            where: {
                name,
                empresaId: parseInt(empresaId),
                NOT: {
                    id: parseInt(id)
                }
            }
        });
        
        if (categoriaExistente) {
            return res.status(400).json({
                success: false,
                message: 'Já existe outra categoria com este nome para esta empresa'
            });
        }
        
        // Atualizar categoria
        const categoria = await prisma.category.update({
            where: { id: parseInt(id) },
            data: {
                name,
                empresaId: parseInt(empresaId)
            }
        });
        
        res.json({
            success: true,
            message: 'Categoria atualizada com sucesso!',
            categoria
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao atualizar categoria');
    }
};

/**
 * Excluir categoria
 */
exports.excluirCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se a categoria existe
        const categoria = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: true
            }
        });
        
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }
        
        // Excluir categoria (as relações serão excluídas em cascata conforme definido no schema)
        await prisma.category.delete({
            where: { id: parseInt(id) }
        });
        
        res.json({
            success: true,
            message: 'Categoria excluída com sucesso!'
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao excluir categoria');
    }
};
