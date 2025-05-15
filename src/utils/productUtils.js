/**
 * Processa dados do produto antes de salvar no banco de dados
 * @param {Object} data - Dados do produto a processar
 * @returns {Object} - Dados processados
 */
exports.processProductData = (data) => {
    // Cria uma cópia para não alterar o objeto original
    const processedData = { ...data };
    
    // Converte string 'true'/'false' para booleano para o campo boolPromo
    if (processedData.boolPromo) {
        processedData.boolPromo = processedData.boolPromo === 'true';
    }
    
    // Converte campos numéricos
    if (processedData.preco) {
        processedData.preco = parseFloat(processedData.preco);
    }
    
    if (processedData.estoque) {
        processedData.estoque = parseInt(processedData.estoque);
    }
    
    if (processedData.desconto) {
        processedData.desconto = parseInt(processedData.desconto);
    }
    
    // Se codBarra for uma string vazia, define como null
    if (processedData.codBarra === '') {
        processedData.codBarra = null;
    }
    
    return processedData;
};

/**
 * Função para depuração do conteúdo de um FormData
 * @param {FormData} formData - O objeto FormData a ser inspecionado
 * @returns {Object} - Um objeto com os dados do FormData
 */
exports.debugFormData = (formData) => {
    const object = {};
    formData.forEach((value, key) => {
        // Verificar se é um arquivo
        if (value instanceof File) {
            object[key] = `File: ${value.name} (${value.size} bytes)`;
        } else {
            object[key] = value;
        }
    });
    return object;
};
