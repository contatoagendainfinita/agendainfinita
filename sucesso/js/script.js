document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO ---
    const CHECK_URL = 'https://webhook.msgagenciadigital.com/webhook/api-woovi-checkout-consultar';
    const CHECK_PARAM = 'hash';
    // !!! CONFIGURE A URL REAL DA SUA ÁREA DE MEMBROS ABAIXO !!!
    const MEMBER_AREA_BASE_URL = 'https://sua-plataforma-de-membros.com/acesso';

    // --- ELEMENTOS DO DOM ---
    const loadingSpinner = document.getElementById('loading-spinner');
    const mainContent = document.getElementById('main-content');
    const errorMessage = document.getElementById('error-message'); // Novo elemento de erro

    const elements = {
        transactionId: document.getElementById('transaction-id'),
        customerName: document.getElementById('customer-name'),
        customerEmail: document.getElementById('customer-email'),
        customerPhone: document.getElementById('customer-phone'),
        productImage: document.getElementById('product-image'),
        productName: document.getElementById('product-name'),
        productDescription: document.getElementById('product-description'),
        productPrice: document.getElementById('product-price'),
        totalPrice: document.getElementById('total-price'),
        memberAreaLink: document.getElementById('member-area-link'),
    };

    // --- FUNÇÕES AUXILIARES ---

    // Obtém parâmetros da URL de forma segura
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = decodeURIComponent(value.replace(/\+/g, ' '));
        }
        return result;
    }

// Formata um valor numérico para o formato de moeda brasileiro (R$)
function formatBRL(value) {
    if (!value && value !== 0) return 'R$ 0,00';
    let number = parseFloat(value);
    if (isNaN(number)) return 'R$ 0,00';

    // CORREÇÃO: Se for um número inteiro, assume que está em centavos e divide por 100
    if (Number.isInteger(number)) {
        number = number / 100;
    }

    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

    // Exibe o conteúdo principal e esconde os indicadores de carregamento/erro
    function showContent() {
        mainContent.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        errorMessage.classList.add('hidden');
    }

    // Exibe uma mensagem de erro para o usuário
    function showError() {
        loadingSpinner.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
    
    // Preenche a página com os dados da transação
    function populatePage(data) {
        if (data.hash) elements.transactionId.textContent = data.hash;
        if (data.customer && typeof data.customer === 'object') {
            elements.customerName.textContent = data.customer.name || '-';
            elements.customerEmail.textContent = data.customer.email || '-';
            elements.customerPhone.textContent = data.customer.phone_number || data.customer.phone || '-';
        }
        if (data.mainProduct && typeof data.mainProduct === 'object') {
            elements.productName.textContent = data.mainProduct.name || 'Produto Adquirido';
            elements.productDescription.textContent = data.mainProduct.description || 'Obrigado pela sua compra!';
            
            // Validação de segurança básica para a URL da imagem
            if (data.mainProduct.imageUrl && data.mainProduct.imageUrl.startsWith('https://')) {
                elements.productImage.src = data.mainProduct.imageUrl;
            }
        }
        if (data.amount || data.totalAmount) {
            const value = formatBRL(data.amount || data.totalAmount);
            elements.productPrice.textContent = value;
            elements.totalPrice.textContent = value;
        }
        
        // Monta o link para a área de membros de forma segura
        if (data.hash) {
            elements.memberAreaLink.href = `${MEMBER_AREA_BASE_URL}?hash=${data.hash}`;
        }
    }

    // Busca os dados completos da transação na API
    async function fetchTransactionDetails(hash) {
        if (!hash) {
            console.error('Hash da transação não encontrado na URL.');
            return null;
        }

        try {
            const url = new URL(CHECK_URL);
            url.searchParams.set(CHECK_PARAM, hash);

            const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            // Normaliza a resposta para aceitar tanto {objeto} quanto [{objeto}]
            return Array.isArray(data) ? data[0] : data;

        } catch (error) {
            console.error('Falha ao buscar detalhes da transação:', error);
            return null;
        }
    }

    // --- LÓGICA PRINCIPAL ---
    (async () => {
        const urlData = getUrlParams();
        const hash = urlData.hash;

        // 1. Preenche o que for possível com os dados da URL (feedback imediato)
        populatePage({ hash, amount: urlData.valor });

        // 2. Busca os dados completos na API
        const apiData = await fetchTransactionDetails(hash);

        // 3. Mescla os dados e preenche a página novamente
        if (apiData) {
            populatePage({ ...urlData, ...apiData });
            showContent(); // Mostra o conteúdo em caso de sucesso
        } else {
            // Em caso de falha, mostra a mensagem de erro
            showError();
        }
    })();
});