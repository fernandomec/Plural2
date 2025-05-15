/**
 * Trata erros nas chamadas de API, retornando um formato consistente
 * @param {Response} res - Objeto de resposta do Express
 * @param {Error} error - Objeto de erro
 * @param {string} defaultMessage - Mensagem padrão caso não haja mensagem específica no erro
 */
exports.handleApiError = (res, error, defaultMessage = 'Erro interno do servidor') => {
    console.error(`API Error: ${defaultMessage}`, error);
    
    // Verificar se é um erro do Prisma
    if (error.code) {
        // Tratar alguns erros comuns do Prisma
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            const message = field 
                ? `Já existe um registro com este ${field}` 
                : 'Duplicação de dados não permitida';
                
            return res.status(400).json({ 
                success: false, 
                message
            });
        }
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Registro não encontrado'
            });
        }
    }
    
    // Erro genérico
    res.status(500).json({ 
        success: false, 
        message: error.message || defaultMessage,
        error: process.env.NODE_ENV === 'production' ? undefined : error.toString()
    });
};
