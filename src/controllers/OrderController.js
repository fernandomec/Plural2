const { PrismaClient, OrderStatus } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    async getCheckoutPage(req, res) {
        try {
            const userId = req.user.id;
            const userCart = await prisma.carrinho.findUnique({
                where: { userId },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    images: true,
                                    empresa: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!userCart || !userCart.items || userCart.items.length === 0) {
                req.flash('error', 'Seu carrinho está vazio.');
                return res.redirect('/carrinho');
            }

            const carrinhoItems = userCart.items.filter(item => item.product);

            if (carrinhoItems.length === 0) {
                req.flash('error', 'Todos os produtos no seu carrinho não estão mais disponíveis.');
                return res.redirect('/carrinho');
            }

            let subtotal = 0;
            carrinhoItems.forEach(item => {
                let preco = item.product.preco;
                if (item.product.boolPromo && item.product.desconto) {
                    preco = preco * (1 - item.product.desconto / 100);
                }
                subtotal += item.quantidade * preco;
            });

            // Agrupar itens por empresa
            const empresasMap = {};
            carrinhoItems.forEach(item => {
                const empresa = item.product.empresa;
                if (empresa) {
                    if (!empresasMap[empresa.id]) {
                        empresasMap[empresa.id] = {
                            empresa,
                            items: []
                        };
                    }
                    empresasMap[empresa.id].items.push(item);
                }
            });

            // Calcular frete para cada empresa
            const fretes = [];
            let freteTotal = 0;
            const userDisplayState = req.user.estado;

            for (const empresaId in empresasMap) {
                const empresa = empresasMap[empresaId].empresa;
                let precoFrete = 0;
                let fretesPorEstado = Array.isArray(empresa.fretesPorEstado) ? empresa.fretesPorEstado : [];
                if (userDisplayState) {
                    const freteRule = fretesPorEstado.find(f => f.estado === userDisplayState);
                    if (freteRule) {
                        precoFrete = freteRule.preco;
                    } else {
                        const fretePadraoRule = fretesPorEstado.find(f => f.estado === "ZZ");
                        if (fretePadraoRule) {
                            precoFrete = fretePadraoRule.preco;
                        }
                    }
                } else {
                    const fretePadraoRule = fretesPorEstado.find(f => f.estado === "ZZ");
                    if (fretePadraoRule) {
                        precoFrete = fretePadraoRule.preco;
                    }
                }
                fretes.push({
                    lojaNome: empresa.razaoSocial || empresa.nome || `Loja #${empresa.id}`,
                    preco: precoFrete
                });
                freteTotal += precoFrete;
            }

            const totalFinal = subtotal + freteTotal;

            res.render('checkout', {
                user: req.user,
                carrinhoItems,
                subtotal,
                fretes,
                freteTotal,
                totalFinal,
                empresaId: carrinhoItems[0].product.empresa ? carrinhoItems[0].product.empresa.id : null,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            });
        } catch (error) {
            console.error('Error getting checkout page:', error);
            res.status(500).render('404', { message: 'Erro ao carregar a página de checkout.' });
        }
    },

    async confirmCheckout(req, res) {
        try {
            const userId = req.user.id;
            const { 
                paymentMethod, 
                empresaIdHidden,
                // Address fields from form
                shipping_endereco,
                shipping_complemento,
                shipping_bairro,
                shipping_cep,
                shipping_cidade,
                shipping_estado
            } = req.body;

            const userCart = await prisma.carrinho.findUnique({
                where: { userId },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    empresa: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!userCart || !userCart.items || userCart.items.length === 0) {
                return res.status(400).send('Carrinho vazio.');
            }
            
            const carrinhoItems = userCart.items.filter(item => item.product);
            if (carrinhoItems.length === 0) {
                return res.status(400).send('Nenhum produto válido no carrinho.');
            }
            
            const empresaIdForOrder = parseInt(empresaIdHidden || (carrinhoItems[0].product.empresa ? carrinhoItems[0].product.empresa.id : null));
            if (!empresaIdForOrder) {
                console.error("Error: Empresa ID for order could not be determined.");
                return res.status(500).render('404', { message: 'Erro ao determinar a loja do pedido.' });
            }
            
            const empresaForShipping = await prisma.empresa.findUnique({ where: {id: empresaIdForOrder }});

            let itemsSubtotal = 0;
            const orderItemsData = carrinhoItems.map(item => {
                let precoFinal = item.product.preco;
                if (item.product.boolPromo && item.product.desconto) {
                    precoFinal = precoFinal * (1 - item.product.desconto / 100);
                }
                itemsSubtotal += item.quantidade * precoFinal;
                return {
                    productId: item.product.id,
                    productName: item.product.name,
                    productPrice: precoFinal,
                    quantity: item.quantidade,
                };
            });

            // Calculate shipping cost
            let confirmedShippingCost = 0;
            const confirmedState = shipping_estado ? shipping_estado.toUpperCase() : null;

            if (empresaForShipping && confirmedState) {
                const fretesPorEstado = Array.isArray(empresaForShipping.fretesPorEstado) ? 
                    empresaForShipping.fretesPorEstado : [];
                
                const freteRule = fretesPorEstado.find(f => f.estado === confirmedState);
                if (freteRule) {
                    confirmedShippingCost = freteRule.preco;
                } else {
                    const fretePadraoRule = fretesPorEstado.find(f => f.estado === "ZZ");
                    if (fretePadraoRule) {
                        confirmedShippingCost = fretePadraoRule.preco;
                    }
                }
            } else if (empresaForShipping) {
                const fretesPorEstado = Array.isArray(empresaForShipping.fretesPorEstado) ? 
                    empresaForShipping.fretesPorEstado : [];
                
                const fretePadraoRule = fretesPorEstado.find(f => f.estado === "ZZ");
                if (fretePadraoRule) {
                    confirmedShippingCost = fretePadraoRule.preco;
                }
            }

            const totalAmount = itemsSubtotal + confirmedShippingCost;
            
            // Prepare address string
            const fullAddress = `${shipping_endereco}, ${shipping_complemento || ''} - ${shipping_bairro}, ${shipping_cidade} / ${shipping_estado} - CEP: ${shipping_cep}`;

            // Create order
            const pedido = await prisma.pedido.create({
                data: {
                    userId,
                    empresaId: empresaIdForOrder,
                    totalAmount,
                    paymentMethod: paymentMethod || "Não Especificado",
                    status: OrderStatus.PEDIDO_RECEBIDO,
                    shippingAddressFull: fullAddress,
                    shippingCost: confirmedShippingCost,
                    orderItems: {
                        create: orderItemsData
                    }
                }
            });

            // Clear cart
            await prisma.carrinhoItem.deleteMany({
                where: { carrinhoId: userCart.id }
            });
            
            await prisma.carrinho.update({
                where: { id: userCart.id },
                data: { items: { deleteMany: {} } }
            });

            // Redirect to order status page
            return res.redirect('/status-pedido?success=true&pedidoId=' + pedido.id);

        } catch (error) {
            console.error('Error confirming checkout:', error);
            return res.status(500).render('404', { message: 'Erro ao confirmar o pedido.' });
        }
    },

    async getOrderStatusPage(req, res) {
        try {
            const userId = req.user.id;
            const pedidos = await prisma.pedido.findMany({
                where: { userId },
                include: {
                    orderItems: {
                        include: {
                            product: { // Ensure product is included for item details
                                include: {
                                    images: true // And images for the product
                                }
                            }
                        }
                    },
                    empresa: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            res.render('status-pedido', {
                user: req.user,
                pedidos,
                OrderStatus // Pass enum for display
            });
        } catch (error) {
            console.error('Error getting order status page:', error);
            res.status(500).render('404', { message: 'Erro ao carregar o status dos pedidos.' });
        }
    }
};
