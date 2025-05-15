const carrinho = await prisma.carrinho.findUnique({
    where: { userId: req.user.id },
    include: {
        items: {
            include: {
                product: {
                    include: { images: true }
                }
            }
        }
    }
});