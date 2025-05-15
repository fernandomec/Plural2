const { PrismaClient, OrderStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleApiError } = require('../utils/errorHandler');
const { formatarPedidoStatus } = require('../utils/formatters');

// Adicione esta função utilitária no topo do arquivo ou antes de exports.listarPedidos
function formatPedidoStatus(status) {
    const statusMap = {
        'PEDIDO_RECEBIDO': 'Pedido Recebido',
        'PAGAMENTO_APROVADO': 'Pagamento Aprovado',
        'EM_SEPARACAO': 'Em Separação',
        'ENVIADO_TRANSPORTADORA': 'Enviado à Transportadora',
        'EM_TRANSPORTE': 'Em Transporte',
        'EM_ROTA_DE_ENTREGA': 'Em Rota de Entrega',
        'ENTREGUE': 'Entregue',
        'TROCA_DEVOLUCAO_SOLICITADA': 'Devolução Solicitada',
        'TROCA_DEVOLUCAO_CONCLUIDA': 'Devolução Concluída',
        'CANCELADO': 'Cancelado'
    };
    return statusMap[status] || status;
}

/**
 * Listar pedidos (view)
 */
exports.listarPedidos = async (req, res) => {
    try {
        const filtroEmpresa = req.query.empresa ? parseInt(req.query.empresa) : null;
        const filtroUsuario = req.query.usuario ? parseInt(req.query.usuario) : null;
        const filtroStatus = req.query.status;
        const filtroDataInicio = req.query.dataInicio;
        const filtroDataFim = req.query.dataFim;
        const filtroValorMinimo = req.query.valorMinimo ? parseFloat(req.query.valorMinimo) : null;
        
        // Construir o objeto de filtro
        const where = {};
        
        if (filtroEmpresa) {
            where.empresaId = filtroEmpresa;
        }
        
        if (filtroUsuario) {
            where.userId = filtroUsuario;
        }
        
        if (filtroStatus) {
            where.status = filtroStatus;
        }
        
        if (filtroDataInicio || filtroDataFim) {
            where.createdAt = {};
            
            if (filtroDataInicio) {
                where.createdAt.gte = new Date(filtroDataInicio);
            }
            
            if (filtroDataFim) {
                where.createdAt.lte = new Date(filtroDataFim);
                // Ajustar para fim do dia
                where.createdAt.lte.setHours(23, 59, 59, 999);
            }
        }
        
        if (filtroValorMinimo) {
            where.totalAmount = {
                gte: filtroValorMinimo
            };
        }
        
        const pedidos = await prisma.pedido.findMany({
            where,
            include: {
                user: true,
                empresa: true,
                orderItems: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        // Buscar empresas e usuários para filtros
        const empresas = await prisma.empresa.findMany({
            orderBy: {
                razaoSocial: 'asc'
            }
        });
        
        const usuarios = await prisma.user.findMany({
            orderBy: {
                username: 'asc'
            }
        });
        
        res.render('admin', {
            user: req.user,
            pedidos,
            empresas,
            usuarios,
            totalPedidos: pedidos.length,
            pageContent: 'pedidos',
            formatPedidoStatus
        });
    } catch (error) {
        console.error('Erro ao carregar página de pedidos:', error);
        res.status(500).send('Erro ao carregar página de pedidos: ' + error.message);
    }
};

/**
 * Exibe formulário de edição de pedido
 */
exports.getFormEditarPedido = async (req, res) => {
    try {
        const { id } = req.params;
        
        const pedido = await prisma.pedido.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: true,
                empresa: true,
                orderItems: {
                    include: {
                        product: true
                    }
                }
            }
        });
        
        if (!pedido) {
            return res.status(404).send('Pedido não encontrado');
        }
        
        res.render('admin', {
            user: req.user,
            pedido,
            pageContent: 'edit-pedido',
            pageTitle: `Editar Pedido #${pedido.id}`,
            formatPedidoStatus
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de pedido:', error);
        res.status(500).send('Erro ao carregar formulário de edição de pedido: ' + error.message);
    }
};

/**
 * Atualizar o status de um pedido
 */
exports.atualizarStatusPedido = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Validação básica
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status não fornecido' 
            });
        }
        
        // Verificar se o status é válido (usando o enum OrderStatus do Prisma)
        const validStatuses = Object.values(OrderStatus);
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status inválido' 
            });
        }
        
        // Atualizar o status do pedido
        const pedido = await prisma.pedido.update({
            where: { id: parseInt(id) },
            data: { status }
        });
        
        res.json({
            success: true,
            message: 'Status do pedido atualizado com sucesso!',
            pedido
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao atualizar status do pedido');
    }
};

/**
 * API para obter detalhes de um pedido específico
 */
exports.getPedido = async (req, res) => {
    try {
        const { id } = req.params;
        
        const pedido = await prisma.pedido.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: true,
                empresa: true,
                orderItems: {
                    include: {
                        product: true
                    }
                }
            }
        });
        
        if (!pedido) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }
        
        res.json({
            success: true,
            pedido
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao buscar pedido');
    }
};

/**
 * API para listar pedidos pendentes
 */
exports.getPedidosPendentes = async (req, res) => {
    try {
        const pedidos = await prisma.pedido.findMany({
            where: {
                status: {
                    notIn: ['ENTREGUE', 'CANCELADO']
                }
            },
            include: {
                user: true,
                empresa: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        res.json({
            success: true,
            pedidos,
            total: pedidos.length
        });
    } catch (error) {
        handleApiError(res, error, 'Erro ao buscar pedidos pendentes');
    }
};
