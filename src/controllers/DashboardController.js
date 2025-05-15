const { PrismaClient, OrderStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const { formatarPedidoStatus } = require('../utils/formatters');

/**
 * Renderiza a dashboard principal do admin
 */
exports.getDashboard = async (req, res) => {
    try {
        console.log('Loading dashboard data...');
        
        // Calcular o primeiro dia do mês atual
        const dataInicio = new Date();
        dataInicio.setDate(1);
        dataInicio.setHours(0, 0, 0, 0);
        
        // Calcular o último dia do mês atual
        const dataFim = new Date();
        dataFim.setHours(23, 59, 59, 999);
        
        console.log('Date range:', dataInicio, 'to', dataFim);
        
        // Consultar todos os pedidos
        const pedidos = await prisma.pedido.findMany({
            include: {
                orderItems: true,
                user: true,
                empresa: true
            }
        });
        
        console.log('Total pedidos found:', pedidos.length);
        
        // Calcular vendas totais do mês atual
        const pedidosMesAtual = pedidos.filter(pedido => {
            const pedidoDate = new Date(pedido.createdAt);
            return pedidoDate >= dataInicio && pedidoDate <= dataFim;
        });
        
        const totalVendasMesAtual = pedidosMesAtual.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
        
        // Contagem de produtos vendidos no mês atual
        const produtosVendidosMesAtual = pedidosMesAtual.reduce((acc, pedido) => {
            return acc + pedido.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);
        
        // Calcular dados do mês anterior e crescimento
        const { totalVendasMesAnterior, crescimento } = await calcularDadosMesAnterior(dataInicio, pedidos, totalVendasMesAtual);
        
        // Contagem de usuários ativos
        const totalUsuarios = await prisma.user.count({ where: { role: 'USER' } });
        
        // Calcular vendas por empresa
        const vendasPorEmpresa = await calcularVendasPorEmpresa(empresas, pedidosMesAtual, totalVendasMesAtual);
        
        // Organizar dados de compras por cliente
        const comprasPorCliente = await organizarComprasClientes();
        
        // Contagem de pedidos por status
        const pedidosPorStatus = await contarPedidosPorStatus(pedidos);
        
        res.render('admin', {
            user: req.user,
            pageContent: 'dashboard',
            totalVendas: totalVendasMesAtual,
            contagem: {
                produtos: produtosVendidosMesAtual
            },
            crescimento,
            totalUsuarios,
            vendasPorEmpresa,
            comprasPorCliente,
            pedidosPorStatus
        });
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        res.status(500).send('Erro ao carregar dashboard: ' + error.message);
    }
};

/**
 * Fornece dados dinâmicos para o dashboard com base no período
 */
exports.getDashboardData = async (req, res) => {
    try {
        const period = req.query.period || 'month'; // Padrão para mês
        
        // Definir a data de início com base no período
        let startDate;
        const now = new Date();
        
        switch (period) {
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }
        
        // Buscar pedidos no período
        const pedidos = await prisma.pedido.findMany({
            where: {
                status: {
                    notIn: ['CANCELADO']
                },
                createdAt: {
                    gte: startDate
                }
            },
            include: {
                empresa: true
            }
        });
        
        // Calcular vendas totais do período
        const totalVendas = pedidos.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
        
        // Estatísticas por empresa
        const empresas = await prisma.empresa.findMany({
            include: {
                pedidos: {
                    where: {
                        status: {
                            notIn: ['CANCELADO']
                        },
                        createdAt: {
                            gte: startDate
                        }
                    }
                }
            }
        });

        // Calcular vendas por empresa no período
        const vendasPorEmpresa = empresas.map(empresa => {
            const totalEmpresa = empresa.pedidos.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
            const percentual = totalVendas > 0 ? (totalEmpresa / totalVendas * 100).toFixed(2) : 0;
            
            return {
                id: empresa.id,
                nome: empresa.razaoSocial,
                totalVendas: totalEmpresa,
                percentual: parseFloat(percentual)
            };
        }).sort((a, b) => b.totalVendas - a.totalVendas);
        
        res.json({
            success: true,
            period,
            totalVendas,
            empresas: vendasPorEmpresa,
            produtosVendidos: await prisma.orderItem.count({
                where: {
                    pedido: {
                        createdAt: {
                            gte: startDate
                        }
                    }
                }
            })
        });
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar dados do dashboard', 
            error: error.message 
        });
    }
};

/**
 * Fornece estatísticas atualizadas para o dashboard
 */
exports.getDashboardStats = async (req, res) => {
    try {
        console.log('Getting dashboard stats...');
        
        // Calcular o primeiro dia do mês atual
        const dataInicio = new Date();
        dataInicio.setDate(1);
        dataInicio.setHours(0, 0, 0, 0);
        
        // Calcular o último dia do mês atual
        const dataFim = new Date();
        dataFim.setHours(23, 59, 59, 999);
        
        // Buscar todos os pedidos com seus itens
        const pedidos = await prisma.pedido.findMany({
            include: {
                orderItems: true
            }
        });
        
        // Calcular vendas totais do mês atual
        const pedidosMesAtual = pedidos.filter(pedido => {
            const pedidoDate = new Date(pedido.createdAt);
            return pedidoDate >= dataInicio && pedidoDate <= dataFim;
        });
        
        const totalVendasMesAtual = pedidosMesAtual.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
        
        // Contagem de produtos vendidos no mês atual
        const produtosVendidosMesAtual = pedidosMesAtual.reduce((acc, pedido) => {
            return acc + pedido.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);
        
        // Dados do mês anterior
        const { crescimento } = await calcularDadosMesAnterior(dataInicio, pedidos, totalVendasMesAtual);
        
        // Contagem de usuários ativos
        const totalUsuarios = await prisma.user.count({
            where: {
                role: 'USER'
            }
        });
        
        res.json({
            success: true,
            totalVendas: totalVendasMesAtual,
            totalProdutos: produtosVendidosMesAtual,
            totalUsuarios,
            crescimento
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas do dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas do dashboard',
            error: error.message
        });
    }
};

/**
 * Fornece contagem de pedidos por status
 */
exports.getPedidosPorStatus = async (req, res) => {
    try {
        // Buscar todos os pedidos
        const pedidos = await prisma.pedido.findMany();
        
        // Contagem de pedidos por status
        const pedidosPorStatus = {};
        Object.values(OrderStatus).forEach(status => {
            pedidosPorStatus[status] = 0;
        });
        
        pedidos.forEach(pedido => {
            if (pedido.status in pedidosPorStatus) {
                pedidosPorStatus[pedido.status]++;
            }
        });
        
        res.json({
            success: true,
            statusCounts: pedidosPorStatus
        });
    } catch (error) {
        console.error('Erro ao buscar contagem de pedidos por status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar contagem de pedidos por status',
            error: error.message
        });
    }
};

// Funções auxiliares
async function calcularDadosMesAnterior(dataInicio, pedidos, totalVendasMesAtual) {
    // Calcular o primeiro dia do mês anterior
    const dataInicioMesAnterior = new Date(dataInicio);
    dataInicioMesAnterior.setMonth(dataInicioMesAnterior.getMonth() - 1);
    
    // Calcular o último dia do mês anterior
    const dataFimMesAnterior = new Date(dataInicio);
    dataFimMesAnterior.setDate(0);
    dataFimMesAnterior.setHours(23, 59, 59, 999);
    
    // Calcular vendas totais do mês anterior
    const pedidosMesAnterior = pedidos.filter(pedido => {
        const pedidoDate = new Date(pedido.createdAt);
        return pedidoDate >= dataInicioMesAnterior && pedidoDate <= dataFimMesAnterior;
    });
    
    const totalVendasMesAnterior = pedidosMesAnterior.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
    
    // Calcular crescimento
    let crescimento = 0;
    if (totalVendasMesAnterior > 0) {
        crescimento = Math.round(((totalVendasMesAtual - totalVendasMesAnterior) / totalVendasMesAnterior) * 100);
    } else if (totalVendasMesAtual > 0) {
        crescimento = 100; // Se não havia vendas no mês anterior, crescimento = 100%
    }
    
    return { totalVendasMesAnterior, crescimento };
}

async function calcularVendasPorEmpresa(pedidosMesAtual, totalVendasMesAtual) {
    const empresas = await prisma.empresa.findMany();
    
    return empresas.map(empresa => {
        const pedidosEmpresa = pedidosMesAtual.filter(pedido => pedido.empresaId === empresa.id);
        const totalVendas = pedidosEmpresa.reduce((acc, pedido) => acc + pedido.totalAmount, 0);
        const percentual = totalVendasMesAtual > 0 
            ? Math.round((totalVendas / totalVendasMesAtual) * 100) 
            : 0;
        
        return {
            id: empresa.id,
            nome: empresa.razaoSocial,
            totalVendas: totalVendas,
            percentual: percentual
        };
    }).sort((a, b) => b.totalVendas - a.totalVendas);
}

async function organizarComprasClientes() {
    const clientes = await prisma.user.findMany({
        where: {
            role: 'USER',
            pedidos: {
                some: {}
            }
        },
        include: {
            pedidos: {
                include: {
                    empresa: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });
    
    return clientes.map(cliente => {
        const totalCompras = cliente.pedidos.reduce((sum, pedido) => sum + pedido.totalAmount, 0);
        const ultimoPedido = cliente.pedidos[0];
        
        // Agrupar compras por empresa
        const empresasMap = new Map();
        
        cliente.pedidos.forEach(pedido => {
            const { empresaId, empresa, totalAmount, createdAt } = pedido;
            
            if (!empresasMap.has(empresaId)) {
                empresasMap.set(empresaId, {
                    empresaId,
                    empresaNome: empresa.razaoSocial,
                    total: 0,
                    ultimoPedido: null
                });
            }
            
            const empresaInfo = empresasMap.get(empresaId);
            empresaInfo.total += totalAmount;
            
            if (!empresaInfo.ultimoPedido || new Date(createdAt) > new Date(empresaInfo.ultimoPedido)) {
                empresaInfo.ultimoPedido = createdAt;
            }
        });
        
        const empresasArray = Array.from(empresasMap.values()).map(empresa => ({
            ...empresa,
            percentual: Math.round((empresa.total / totalCompras) * 100),
            ultimoPedidoFormatado: new Date(empresa.ultimoPedido).toLocaleDateString('pt-BR')
        }));
        
        return {
            clienteId: cliente.id,
            clienteNome: cliente.username,
            totalCompras,
            ultimoPedido: ultimoPedido ? new Date(ultimoPedido.createdAt).toLocaleDateString('pt-BR') : '',
            empresas: empresasArray
        };
    }).sort((a, b) => b.totalCompras - a.totalCompras);
}

async function contarPedidosPorStatus(pedidos) {
    const pedidosPorStatus = {};
    Object.values(OrderStatus).forEach(status => {
        pedidosPorStatus[status] = 0;
    });
    
    pedidos.forEach(pedido => {
        if (pedido.status in pedidosPorStatus) {
            pedidosPorStatus[pedido.status]++;
        }
    });
    
    return pedidosPorStatus;
}
