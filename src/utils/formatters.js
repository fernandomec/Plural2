/**
 * Utilidades para formatação de dados exibidos na interface
 */

/**
 * Formata o status do pedido para exibição amigável
 * @param {string} status - O status do pedido em formato de enum
 * @returns {string} Status formatado para exibição
 */
exports.formatarPedidoStatus = (status) => {
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
};

/**
 * Formata um valor monetário para o formato brasileiro (R$)
 * @param {number} valor - O valor a ser formatado
 * @returns {string} Valor formatado como moeda
 */
exports.formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};

/**
 * Formata uma data para o formato brasileiro
 * @param {Date|string} data - A data a ser formatada
 * @returns {string} Data formatada
 */
exports.formatarData = (data) => {
    const dataObj = data instanceof Date ? data : new Date(data);
    return dataObj.toLocaleDateString('pt-BR');
};
