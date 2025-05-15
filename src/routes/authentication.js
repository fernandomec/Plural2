const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticate, blacklist } = require('../middleware/auth');
const validatePassword = require('../utils/passwordValidator');
const { checkRole } = require('../middleware/roles');

//login
router.get('/login', (req, res) => {
    const token = req.cookies.auth_token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/user');
        } catch (err) {
            res.clearCookie('auth_token');
        }
    }
    res.render('login', { user: null });
});
router.post('/login', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { email: req.body.email }
        });

        if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
            return res.status(401).json({
                auth: false,
                message: 'Email ou senha inválidos.'
            });
        }

        const token = jwt.sign(
            { email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 86400000 //24h
        });

        return res.json({
            auth: true,
            token,
            user: { email: user.email, username: user.username }
        });
    } catch (error) {
        res.status(500).json({
            auth: false,
            message: 'Erro interno do servidor.'
        });
    }
});

//registro
router.get('/register', (req, res) => {
    const token = req.cookies.auth_token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/user');
        } catch (err) {
            res.clearCookie('auth_token');
        }
    }
    res.render('register', { user: null });
});
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        
        const passwordValidationResult = validatePassword(password);
        if (!passwordValidationResult.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordValidationResult.message
            });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email já está em uso.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email, username, password: hashedPassword }
        });


        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso!'
        });
    } catch (error) {        
        res.status(500).json({
            success: false,
            message: 'Erro ao criar conta: ' + error.message
        });
    }
});

//logout
router.post('/logout', (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (token) {
            blacklist.push(token);
            res.clearCookie('auth_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro no logout:', error);
        res.status(500).json({ success: false });
    }
});

//página do usuário
router.get('/user', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }

        let cartData = null;
        const userCart = await prisma.carrinho.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                }
            }
        });

        let totalCartItems = 0;
        if (userCart && userCart.items) {
            // Filter out items where product might have been deleted
            userCart.items = userCart.items.filter(item => item.product);
            totalCartItems = userCart.items.reduce((sum, item) => sum + item.quantidade, 0);
            cartData = {
                items: userCart.items, // These are CarrinhoItem
                totalItems: totalCartItems
            };
        } else {
            cartData = {
                items: [],
                totalItems: 0
            };
        }
        
        res.locals.carrinho = cartData; // Make sure this structure is what header expects

        res.render('user', { user: req.user });
    } catch (error) {
        console.error('Erro ao carregar página do usuário:', error);
        res.status(500).send('Erro ao carregar página do usuário');
    }
});

//editar usuário
router.get('/user-edit', authenticate, (req, res) => {
    res.render('user-edit', { user: req.user });
});

router.post('/user-edit', authenticate, async (req, res) => {
    try {
        const { 
            username, 
            newPassword, 
            tel,
            cep, 
            bairro,
            endereco, 
            enderecoComplemento, 
            currentPassword 
        } = req.body;
        
        console.log('Received data:', {
            username, tel, cep, bairro, endereco, enderecoComplemento
        });

        const isValidPassword = await bcrypt.compare(currentPassword, req.user.password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
        }

        const updateData = {
            username,
            tel,
            cep,
            bairro,
            endereco,
            enderecoComplemento,
        };

        if (newPassword) {
            await prisma.pastPassword.create({
                data: {
                    password: req.user.password,
                    userId: req.user.id,
                    createdAt: new Date()
                }
            });
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        console.log('Usuário atualizado:', updatedUser);
        res.redirect('/user');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar usuário' });
    }
});

//admin
router.get('/admin', authenticate, checkRole('ADMIN'), async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany();
        const categorias = await prisma.category.findMany({
            select: {
                id: true,
                name: true,
                empresaId: true
            }
        });
        
        res.render('admin', { 
            user: req.user,
            empresas: empresas,
            categorias: categorias
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar página de admin');
    }
});

//editor
router.get('/editor', authenticate, checkRole('ADMIN', 'EDITOR'), (req, res) => {
    res.render('editor', { user: req.user });
});

//carrinho
router.get('/carrinho', authenticate, async (req, res) => {
    try {
        const userCart = await prisma.carrinho.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true,
                                empresa: { // Ensure FretePorEstado is available
                                    include: {
                                        fretesPorEstado: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!userCart || !userCart.items || userCart.items.length === 0) {
            return res.render('carrinho', {
                user: req.user,
                carrinho: { items: [], subtotal: 0, total: 0, desconto: 0 },
                frete: { preco: 0, precoFormated: "R$ 0,00", estado: null }
            });
        }

        const validItems = userCart.items.filter(item => item.product && item.product.empresa);

        if (validItems.length === 0) {
            return res.render('carrinho', {
                user: req.user,
                carrinho: { items: [], subtotal: 0, total: 0, desconto: 0 },
                frete: { preco: 0, precoFormated: "R$ 0,00", estado: null }
            });
        }

        let subtotal = 0;
        let empresaForShipping = validItems[0].product.empresa; // Assuming all items from the same empresa for now

        validItems.forEach(item => {
            let preco = item.product.preco;
            if (item.product.boolPromo && item.product.desconto) {
                preco = preco * (1 - item.product.desconto / 100);
            }
            subtotal += item.quantidade * preco;
        });

        let frete = { preco: 0, precoFormated: "R$ 0,00", estado: null };
        const userState = req.user.estado; 

        if (empresaForShipping && userState) {
            const freteRule = empresaForShipping.fretesPorEstado.find(f => f.estado === userState);
            if (freteRule) {
                frete.preco = freteRule.preco;
                frete.estado = userState;
            } else {
                const fretePadraoRule = empresaForShipping.fretesPorEstado.find(f => f.estado === "ZZ"); // Convention for "Outros Estados" / Padrão
                if (fretePadraoRule) {
                    frete.preco = fretePadraoRule.preco;
                    frete.estado = userState; // Still show user's state, but price is from ZZ
                } else {
                    // No specific rule and no ZZ rule, or userState is null/undefined
                    frete.precoFormated = "???";
                    frete.preco = 0; // For calculation on this page, treat as 0
                    frete.estado = userState || null;
                }
            }
        } else if (empresaForShipping && !userState) { // User has no state set
             const fretePadraoRule = empresaForShipping.fretesPorEstado.find(f => f.estado === "ZZ");
             if (fretePadraoRule) {
                frete.preco = fretePadraoRule.preco;
                // frete.estado remains null as user has no state
             } else {
                frete.precoFormated = "???";
                frete.preco = 0; // For calculation
                // frete.estado remains null
             }
        } else if (!empresaForShipping) { // Should not happen if cart has items from an empresa
            frete.precoFormated = "???";
            frete.preco = 0;
        }
        
        if (frete.precoFormated !== "???") {
            frete.precoFormated = `R$ ${frete.preco.toFixed(2).replace('.', ',')}`;
        }

        const totalComFrete = subtotal + frete.preco;

        res.render('carrinho', {
            user: req.user,
            carrinho: {
                items: validItems,
                subtotal: subtotal,
                total: totalComFrete,
                desconto: 0 
            },
            frete
        });
    } catch (error) {
        console.error('Erro ao carregar carrinho:', error);
        res.status(500).send('Erro ao carregar carrinho');
    }
});

router.get('/carrinho/summary', authenticate, async (req, res) => {
    try {
        const userCart = await prisma.carrinho.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                empresa: {
                                    include: {
                                        fretesPorEstado: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!userCart || !userCart.items || userCart.items.length === 0) {
            return res.json({ 
                success: true, 
                subtotal: 0, 
                frete: { preco: 0, precoFormated: "R$ 0,00", estado: null }, 
                total: 0 
            });
        }

        const validItems = userCart.items.filter(item => item.product && item.product.empresa);
        if (validItems.length === 0) {
            return res.json({ 
                success: true, 
                subtotal: 0, 
                frete: { preco: 0, precoFormated: "R$ 0,00", estado: null }, 
                total: 0 
            });
        }

        let subtotal = 0;
        const empresaForShipping = validItems[0].product.empresa;

        validItems.forEach(item => {
            let preco = item.product.preco;
            if (item.product.boolPromo && item.product.desconto) {
                preco = preco * (1 - item.product.desconto / 100);
            }
            subtotal += item.quantidade * preco;
        });

        let shippingCost = 0;
        let determinedUserState = req.user.estado; 
        let fretePrecoFormated = "R$ 0,00";

        if (empresaForShipping && determinedUserState) {
            const freteRule = empresaForShipping.fretesPorEstado.find(f => f.estado === determinedUserState);
            if (freteRule) {
                shippingCost = freteRule.preco;
            } else {
                const fretePadraoRule = empresaForShipping.fretesPorEstado.find(f => f.estado === "ZZ");
                if (fretePadraoRule) {
                    shippingCost = fretePadraoRule.preco;
                } else {
                    // No specific or ZZ rule for the user's state
                    shippingCost = 0; // For calculation
                    fretePrecoFormated = "???";
                }
            }
        } else if (empresaForShipping && !determinedUserState) { // User has no state
            const fretePadraoRule = empresaForShipping.fretesPorEstado.find(f => f.estado === "ZZ");
            if (fretePadraoRule) {
                shippingCost = fretePadraoRule.preco;
            } else {
                shippingCost = 0; // For calculation
                fretePrecoFormated = "???";
            }
        } else if (!empresaForShipping) {
             shippingCost = 0;
             fretePrecoFormated = "???";
        }


        if (fretePrecoFormated !== "???") {
            fretePrecoFormated = `R$ ${shippingCost.toFixed(2).replace('.', ',')}`;
        }
        const total = subtotal + shippingCost;

        res.json({
            success: true,
            subtotal,
            frete: {
                preco: shippingCost,
                precoFormated: fretePrecoFormated,
                estado: determinedUserState
            },
            total
        });

    } catch (error) {
        console.error('Erro ao buscar resumo do carrinho:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar resumo do carrinho.' });
    }
});


router.post('/carrinho/add', authenticate, async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;

        // Update this query as well
        // First find or create the cart
        let cart = await prisma.carrinho.findUnique({
            where: { userId: userId }
        });

        if (!cart) {
            cart = await prisma.carrinho.create({
                data: {
                    userId: userId
                }
            });
        }

        // Then find or update the cart item
        const existingItem = await prisma.carrinhoItem.findFirst({
            where: {
                carrinhoId: cart.id,
                productId: parseInt(productId)
            }
        });

        if (existingItem) {
            await prisma.carrinhoItem.update({
                where: { id: existingItem.id },
                data: {
                    quantidade: existingItem.quantidade + 1
                }
            });
        } else {
            await prisma.carrinhoItem.create({
                data: {
                    carrinhoId: cart.id,
                    productId: parseInt(productId),
                    quantidade: 1
                }
            });
        }

        // Fix this query for calculating totals
        const updatedCart = await prisma.carrinho.findMany({
            where: { userId: userId },
            include: { 
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        let total = updatedCart.reduce((soma, cart) => {
            if (!cart.items) return soma;
            
            return soma + cart.items.reduce((itemSum, item) => {
                let preco = item.product.preco;
                if (item.product.boolPromo && item.product.desconto) {
                    preco = preco * (1 - item.product.desconto / 100);
                }
                return itemSum + (item.quantidade * preco);
            }, 0);
        }, 0);

        const totalItems = await prisma.carrinhoItem.aggregate({
            _sum: {
                quantidade: true
            },
            where: { 
                carrinho: {
                    userId: userId
                }
            }
        });

        res.json({
            success: true,
            totalItems: totalItems._sum.quantidade || 0,
            total: total,
            desconto: 0 // Removido desconto fixo
        });
    } catch (error) {
        console.error('Erro ao adicionar ao carrinho:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/carrinho/update', authenticate, async (req, res) => {
    try {
        const { itemId, delta } = req.body;
        const userId = req.user.id;

        const itemToUpdate = await prisma.carrinhoItem.findUnique({
            where: { id: parseInt(itemId) },
            include: { carrinho: true } // Include carrinho to check userId
        });

        if (!itemToUpdate || itemToUpdate.carrinho.userId !== userId) {
            return res.status(404).json({ success: false, message: 'Item não encontrado ou não pertence ao usuário.' });
        }

        const newQuantidade = itemToUpdate.quantidade + parseInt(delta);
        if (newQuantidade <= 0) {
            await prisma.carrinhoItem.delete({
                where: { id: parseInt(itemId) }
            });
        } else {
            await prisma.carrinhoItem.update({
                where: { id: parseInt(itemId) },
                data: { quantidade: newQuantidade }
            });
        }

        const updatedCartItems = await prisma.carrinhoItem.findMany({ // Fetch items to sum quantity
            where: { carrinho: { userId: userId } },
            include: { product: true } // Include product for price calculation
        });

        let newSubtotal = 0;
        let totalQuantity = 0;
        updatedCartItems.forEach(item => {
            if (item.product) { // Ensure product exists
                let preco = item.product.preco;
                if (item.product.boolPromo && item.product.desconto) {
                    preco = preco * (1 - item.product.desconto / 100);
                }
                newSubtotal += item.quantidade * preco;
                totalQuantity += item.quantidade;
            }
        });
        
        // Note: Shipping cost is not recalculated here, only on cart page load or checkout
        // This response is primarily for updating the cart icon and simple totals.

        res.json({
            success: true,
            totalItems: totalQuantity,
            // subtotal: newSubtotal, // Subtotal of items
            // total: newSubtotal, // For simplicity, not including shipping here for the AJAX update
            // desconto: 0 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/carrinho/remove', authenticate, async (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.user.id;

        const itemToRemove = await prisma.carrinhoItem.findUnique({
            where: { id: parseInt(itemId) },
            include: { carrinho: true } // Include carrinho to check userId
        });

        if (!itemToRemove || itemToRemove.carrinho.userId !== userId) {
            return res.status(404).json({ success: false, message: 'Item não encontrado ou não pertence ao usuário.' });
        }

        await prisma.carrinhoItem.delete({
            where: { id: parseInt(itemId) }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;