async function updateQuantity(itemId, delta, productId) { // Added productId
    try {
        const response = await fetch('/carrinho/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemId, delta: parseInt(delta) }) // Ensure delta is number
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro na resposta do servidor' }));
            throw new Error(errorData.message || 'Erro na resposta do servidor');
        }

        const data = await response.json();
        
        if (data.success) {
            const quantityElement = document.getElementById(`quantity-${itemId}`);
            if (!quantityElement) { // Item might have been removed by another action
                updateCartSummary(); // Just update summary
                return;
            }
            const currentQuantity = parseInt(quantityElement.textContent);
            const newQuantity = currentQuantity + parseInt(delta);

            if (newQuantity <= 0) {
                await removeItem(itemId); // This will also update summary
                return;
            }

            quantityElement.textContent = newQuantity;
            
            // Update total for the item
            const itemRow = document.querySelector(`tr[data-item-id="${itemId}"]`);
            const priceText = itemRow.querySelector('td:nth-child(2)').textContent; // Price per unit
            const unitPrice = parseFloat(priceText.replace('R$', '').trim().replace(',', '.'));
            const totalItemElement = document.getElementById(`total-item-${itemId}`);
            if (totalItemElement) {
                totalItemElement.textContent = `R$ ${(unitPrice * newQuantity).toFixed(2)}`;
            }
            
            updateCartSummary(); // Update subtotal, frete, and total geral
            updateCartIcon();

        } else {
            alert(data.message || "Erro ao atualizar quantidade.");
        }

    } catch (error) {
        console.error('Erro em updateQuantity:', error);
        alert('Erro ao atualizar quantidade: ' + error.message);
    }
}

async function removeItem(itemId) {
    try {
        const response = await fetch('/carrinho/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro na resposta do servidor' }));
            throw new Error(errorData.message || 'Erro na resposta do servidor');
        }

        const data = await response.json();
        
        if (data.success) {
            const itemRow = document.querySelector(`tr[data-item-id="${itemId}"]`);
            if (itemRow) {
                itemRow.remove();
            }
            updateCartSummary(); // Update totals
            updateCartIcon();

            const remainingItems = document.querySelectorAll('tbody tr[data-item-id]').length;
            if (remainingItems === 0) {
                // Display empty cart message or redirect
                const carrinhoContainer = document.querySelector('.carrinho-container');
                if (carrinhoContainer) {
                    carrinhoContainer.innerHTML = `
                        <div class="msg-carrinho-vazio">
                            Seu carrinho está vazio.<br>
                            <a href="/lojas" class="checkout-btn" style="margin-top:18px;max-width:220px;">Ver produtos</a>
                        </div>`;
                }
            }
        } else {
            alert(data.message || "Erro ao remover item.");
        }
    } catch (error) {
        console.error('Erro em removeItem:', error);
        alert('Erro ao remover item: ' + error.message);
    }
}

async function updateCartSummary() {
    try {
        const response = await fetch('/carrinho/summary'); // New endpoint needed for just summary data
        if (!response.ok) {
            throw new Error('Falha ao buscar resumo do carrinho');
        }
        const summary = await response.json();

        const subtotalEl = document.querySelector('td[data-subtotal]');
        const freteEl = document.querySelector('td[data-frete-preco]');
        const totalEl = document.querySelector('td[data-total-geral]');

        if (subtotalEl) subtotalEl.textContent = `R$ ${summary.subtotal.toFixed(2)}`;
        if (freteEl) freteEl.textContent = summary.frete.precoFormated;
        if (totalEl) totalEl.textContent = `R$ ${summary.total.toFixed(2)}`;

    } catch (error) {
        console.error('Erro ao atualizar resumo do carrinho:', error);
        // Optionally, inform the user that the summary might be outdated
    }
}

async function updateCartIcon() {
    try {
        const response = await fetch('/carrinho/status'); // Endpoint to get cart status (totalItems)
        if (!response.ok) return;
        const data = await response.json();
        const cartCountElem = document.getElementById('contadorCarrinho');
        if (cartCountElem && typeof data.totalItems === 'number') {
            cartCountElem.textContent = data.totalItems;
        }
    } catch (error) {
        console.error('Erro ao atualizar ícone do carrinho:', error);
    }
}


// Initial load
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.carrinho-container table')) { // Only if cart table exists
        updateCartSummary();
    }
});
