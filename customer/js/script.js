document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO ---
    const CHECK_URL = 'https://webhook.msgagenciadigital.com/webhook/api-woovi-checkout-consultar';
    const CHECK_PARAM = 'hash';

    // --- ELEMENTOS DO DOM ---
    const elements = {
        orderIdDisplay: document.getElementById('orderIdDisplay'),
        amountLabel: document.getElementById('amountLabel'),
        pixKey: document.getElementById('pixKey'),
        pixRaw: document.getElementById('pixRaw'),
        qrImage: document.getElementById('qrImage'),
        countdownEl: document.getElementById('countdown'),
        expiresText: document.getElementById('expiresText'),
        spinner: document.getElementById('spinner'),
        statusTitle: document.getElementById('statusTitle'),
        statusMessage: document.getElementById('statusMessage'),
        copiedMsgTop: document.getElementById('copiedMsgTop'),
        copiedMsgStatus: document.getElementById('copiedMsgStatus'),
        copyPrimary: document.getElementById('copyPrimary'),
        openAppBtn: document.getElementById('openAppBtn'),
        confirmBtn: document.getElementById('confirmBtn'),
        currentYear: document.getElementById('currentYear'),
    };

    // --- FUNÇÕES AUXILIARES ---

    // Obtém parâmetros da URL
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = decodeURIComponent(value.replace(/\+/g, ' '));
        }
        return result;
    }

    // Formata valor em reais (assumindo centavos se for inteiro)
    function formatBRL(value) {
        if (!value && value !== 0) return 'R$ 0,00';
        let number = parseFloat(value);
        if (Number.isInteger(number)) {
            number = number / 100;
        }
        if (isNaN(number)) return 'R$ 0,00';
        return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Controla a visibilidade do spinner
    function showSpinner(show) {
        elements.spinner.style.display = show ? 'block' : 'none';
        elements.spinner.setAttribute('aria-hidden', !show);
    }

    // Mostra uma mensagem de cópia por um tempo
    function showCopyMessage(msgElement) {
        if (!msgElement) return;
        msgElement.style.display = 'block';
        setTimeout(() => msgElement.style.display = 'none', 2500);
    }

    // Copia texto para a área de transferência
    async function copyToClipboard(text) {
        if (!text) return false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            return true;
        } catch (e) {
            console.warn('Falha ao copiar:', e);
            return false;
        }
    }

    // --- LÓGICA DA PÁGINA ---

    // Preenchimento inicial da UI
    function initializeUI() {
        const params = getUrlParams();
        const hash = params.hash || params.transaction || '';
        const orderId = params.orderId || params.id || '';
        const valorParam = params.valor || params.amount || '0.00';
        const pixPayloadRaw = params.chave || params.pix || '';
        const qrBase64 = params.qr_base64 || '';

        const orderDisplay = hash || orderId || `ORD${Math.floor(Math.random() * 900000 + 100000)}`;
        elements.orderIdDisplay.textContent = orderDisplay;
        elements.amountLabel.textContent = formatBRL(valorParam);

        let pixPayload = pixPayloadRaw ? decodeURIComponent(pixPayloadRaw) : '';

        if (qrBase64) {
            elements.qrImage.src = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
            elements.pixRaw.value = pixPayload;
            elements.pixKey.value = pixPayload;
        } else if (pixPayload) {
            if (pixPayload.startsWith('http')) {
                elements.qrImage.src = pixPayload;
                elements.openAppBtn.href = pixPayload;
            } else {
                elements.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(pixPayload)}`;
            }
            elements.pixRaw.value = pixPayload;
            elements.pixKey.value = pixPayload;
        } else {
            const fallback = `PIX - Pedido ${orderDisplay} - ${formatBRL(valorParam)}`;
            elements.pixRaw.value = fallback;
            elements.pixKey.value = fallback;
            elements.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(fallback)}`;
        }

        // Ano atual no footer
        if (elements.currentYear) {
            elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    // Lógica de polling para verificar o status do pagamento
    async function pollStatus() {
        elements.confirmBtn.disabled = true;
        elements.statusTitle.textContent = 'Verificando...';
        elements.statusMessage.textContent = 'Consultando status do pagamento...';
        showSpinner(true);

        const params = getUrlParams();
        const hash = params.hash || params.transaction || '';
        const orderId = params.orderId || params.id || '';

        const key = (CHECK_PARAM === 'orderId') ? (orderId || hash) : (hash || orderId);
        if (!key) {
            elements.statusTitle.textContent = 'Identificador não encontrado.';
            showSpinner(false);
            return;
        }

        try {
            const url = new URL(CHECK_URL);
            url.searchParams.set(CHECK_PARAM, key);
            const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}`);
            }

            const data = await response.json();
            const body = Array.isArray(data) && data.length > 0 ? data[0].body || data[0] : data.body || data;
            
            const status = body?.status?.toLowerCase() || 'unknown';
            const pixCandidate = body?.pix?.payload || body?.qr;

            if (/(paid|pago|confirmed)/.test(status)) {
                elements.statusTitle.textContent = 'Pago ✅';
                elements.statusMessage.textContent = 'Pagamento confirmado! Redirecionando...';
                showSpinner(false);
                setTimeout(() => {
                    window.location.href = `../sucesso?${new URLSearchParams(window.location.search).toString()}`;
                }, 800);
                return;
            } else if (/(waiting|pending|waiting_payment|pendente)/.test(status)) {
                elements.statusTitle.textContent = 'Pendente. Verifique novamente em instantes.';
                elements.statusMessage.textContent = 'Pagamento ainda não confirmado.';
            } else if (/(expired|vencido|failed|rejected)/.test(status)) {
                elements.statusTitle.textContent = 'Expirado / Rejeitado';
                elements.statusMessage.textContent = 'Pagamento não realizado. Gere outro PIX.';
                showSpinner(false);
                return;
            } else {
                elements.statusTitle.textContent = `Status: ${status}`;
                elements.statusMessage.textContent = 'Aguardando confirmação...';
            }

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            elements.statusTitle.textContent = 'Erro de rede';
            elements.statusMessage.textContent = 'Tente novamente.';
        } finally {
            elements.confirmBtn.disabled = false;
            showSpinner(false);
        }
    }

    // Countdown
    function startCountdown(seconds = 10 * 60) {
        let t = seconds;
        const interval = setInterval(() => {
            const minutes = Math.floor(t / 60);
            const secondsRemaining = t % 60;
            elements.countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`;
            if (t <= 0) {
                clearInterval(interval);
                elements.countdownEl.textContent = 'EXPIRADO';
                elements.statusTitle.textContent = 'Expirado';
                elements.statusMessage.textContent = 'Tempo esgotado. Gere outro PIX.';
                elements.confirmBtn.disabled = true;
            }
            t--;
        }, 1000);
    }

    // --- EVENT LISTENERS ---
    elements.copyPrimary.addEventListener('click', async () => {
        const text = elements.pixKey.value || elements.pixRaw.value;
        if (!text) {
            alert('Nenhum código para copiar');
            return;
        }
        const success = await copyToClipboard(text);
        if (success) {
            showCopyMessage(elements.copiedMsgTop);
        } else {
            alert('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
        }
    });

    elements.pixRaw.addEventListener('click', () => {
        const text = elements.pixRaw.value || elements.pixKey.value;
        copyToClipboard(text);
        showCopyMessage(elements.copiedMsgStatus);
    });

    elements.openAppBtn.addEventListener('click', (ev) => {
        const href = elements.openAppBtn.getAttribute('href') || '#';
        if (href === '#' || href.trim() === '') {
            ev.preventDefault();
            if (elements.qrImage && elements.qrImage.src) {
                window.open(elements.qrImage.src, '_blank', 'noopener');
            }
        }
    });

    elements.confirmBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        pollStatus();
    });

    // --- INICIALIZAÇÃO ---
    initializeUI();
    startCountdown();
    showSpinner(true);
    setTimeout(() => showSpinner(false), 700);
});