const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getFormFreteEmpresa = async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({
            orderBy: { razaoSocial: 'asc' }
        });
        res.render('partials-admin/frete-empresa/create-frete', { empresas });
    } catch (error) {
        console.error('Erro ao carregar formulário de frete:', error);
        res.status(500).send('Erro ao carregar formulário de frete');
    }
};

exports.cadastrarFreteEmpresa = async (req, res) => {
    try {
        const { empresaId, fretes } = req.body;
        if (!empresaId || !fretes || typeof fretes !== 'object') {
            return res.status(400).json({ success: false, message: 'Dados inválidos.' });
        }

        // Remove fretes antigos da empresa
        await prisma.fretePorEstado.deleteMany({
            where: { empresaId: parseInt(empresaId) }
        });

        // Cria os novos fretes
        const dataToCreate = Object.entries(fretes).map(([estado, preco]) => ({
            empresaId: parseInt(empresaId),
            estado,
            preco: parseFloat(preco)
        }));

        await prisma.fretePorEstado.createMany({ data: dataToCreate });

        res.json({ success: true, message: 'Fretes cadastrados com sucesso!' });
    } catch (error) {
        console.error('Erro ao cadastrar fretes:', error);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar fretes.' });
    }
};
