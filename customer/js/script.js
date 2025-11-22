((document, window) => {

    // --- CONFIGURAÇÃO ---
    const CONFIG = {
        CHECK_URL: 'https://webhook.msgagenciadigital.com/webhook/api-woovi-checkout-consultar',
        CHECK_PARAM: 'hash',
        CHECKOUT_URL: '/checkout/',
        SUCCESS_URL: '../sucesso.html',
        POLLING_MAX_ATTEMPTS: 10,
        POLLING_DELAY: 5000, // 5 segundos
        COUNTDOWN_SECONDS: 10 * 60, // 10 minutos
        COPY_MESSAGE_DURATION: 2500,
        REDIRECT_DELAY: 800,
    };

    // --- ELEMENTOS DO DOM ---
    const elements = {
        // Estados de UI
        initialLoading: document.getElementById('initial-loading'),
        noHashError: document.getElementById('no-hash-error'),
        invalidHashError: document.getElementById('invalid-hash-error'),
        mainContent: document.getElementById('main-content'),
        validationAlert: document.getElementById('validation-alert'),
        validationMessage: document.getElementById('validation-message'),

        // Header
        orderIdDisplay: document.getElementById('orderIdDisplay'),
        amountLabel: document.getElementById('amountLabel'),

        // Seção PIX
        pixKey: document.getElementById('pixKey'),
        pixRaw: document.getElementById('pixRaw'),
        qrImage: document.getElementById('qrImage'),
        countdownEl: document.getElementById('countdown'),

        // Status e Mensagens
        spinner: document.getElementById('spinner'),
        statusTitle: document.getElementById('statusTitle'),
        statusMessage: document.getElementById('statusMessage'),
        pollingProgress: document.getElementById('pollingProgress'),
        copiedMsgTop: document.getElementById('copiedMsgTop'),
        copiedMsgStatus: document.getElementById('copiedMsgStatus'),

        // Botões e Ações
        copyPrimary: document.getElementById('copyPrimary'),
        openAppBtn: document.getElementById('openAppBtn'),
        confirmBtn: document.getElementById('confirmBtn'),
    };

    // --- VALIDAÇÃO ---

    /**
     * Valida se o hash tem formato válido (32 caracteres hexadecimais)
     */
    function isValidHash(hash) {
        return hash && /^[a-f0-9]{32}$/i.test(hash);
    }

    /**
     * Mostra alerta de validação
     */
    function showValidationAlert(message) {
        if (!elements.validationAlert || !elements.validationMessage) return;
        elements.validationMessage.textContent = message;
        elements.validationAlert.classList.remove('hidden');
    }

    /**
     * Esconde alerta de validação
     */
    function hideValidationAlert() {
        if (!elements.validationAlert) return;
        elements.validationAlert.classList.add('hidden');
    }

    // --- FUNÇÕES AUXILIARES ---

    /**
     * Obtém parâmetros da URL
     */
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = decodeURIComponent(value.replace(/\+/g, ' '));
        }
        return result;
    }

    /**
     * Formata valor em reais (assumindo centavos se for inteiro)
     */
    function formatBRL(value) {
        if (!value && value !== 0) return 'R$ 0,00';
        let number = parseFloat(value);
        
        // Se for um número inteiro maior que 10, assume que são centavos
        if (Number.isInteger(number) && number >= 10) {
            number = number / 100;
        }
        
        if (isNaN(number)) return 'R$ 0,00';
        return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    /**
     * Controla a visibilidade do spinner
     */
    function showSpinner(show) {
        if (!elements.spinner) return;
        elements.spinner.style.display = show ? 'block' : 'none';
        elements.spinner.setAttribute('aria-hidden', String(!show));
    }

    /**
     * Mostra uma mensagem de cópia por um tempo
     */
    function showCopyMessage(msgElement) {
        if (!msgElement) return;
        msgElement.style.display = 'block';
        setTimeout(() => {
            msgElement.style.display = 'none';
        }, CONFIG.COPY_MESSAGE_DURATION);
    }

    /**
     * Copia texto para a área de transferência
     */
    async function copyToClipboard(text) {
        if (!text) return false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback para navegadores antigos
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.opacity = '0';
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

    /**
     * Atualiza o status visual da box de status
     */
    function updateStatusBox(type, title, message) {
        const statusBox = elements.statusTitle?.parentElement;
        if (statusBox) {
            // Remove classes antigas
            statusBox.classList.remove('status-box--success', 'status-box--error', 'status-box--expired');
            // Adiciona nova classe se fornecida
            if (type) {
                statusBox.classList.add(`status-box--${type}`);
            }
        }
        
        if (elements.statusTitle) elements.statusTitle.textContent = title;
        if (elements.statusMessage) elements.statusMessage.textContent = message;
    }

    /**
     * Mostra progresso do polling
     */
    function showPollingProgress(current, total) {
        if (!elements.pollingProgress) return;
        elements.pollingProgress.textContent = `Tentativa ${current} de ${total}...`;
        elements.pollingProgress.classList.remove('hidden');
    }

    /**
     * Esconde progresso do polling
     */
    function hidePollingProgress() {
        if (!elements.pollingProgress) return;
        elements.pollingProgress.classList.add('hidden');
    }

    /**
     * Habilita/desabilita botão de copiar
     */
    function enableCopyButton(enable) {
        if (!elements.copyPrimary) return;
        elements.copyPrimary.disabled = !enable;
    }

    // --- LÓGICA DA PÁGINA ---

    /**
     * Busca dados do PIX na API e preenche a UI
     */
    async function fetchAndPopulatePix(hash, urlParams) {
        try {
            const url = new URL(CONFIG.CHECK_URL);
            url.searchParams.set(CONFIG.CHECK_PARAM, hash);
            
            const response = await fetch(url.toString(), { 
                method: 'GET', 
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            
            // A API pode retornar: { body: {...} } ou diretamente {...}
            // Também pode retornar um array: [{ body: {...} }] ou [{...}]
            let body;
            if (Array.isArray(data) && data.length > 0) {
                body = data[0].body || data[0];
            } else {
                body = data.body || data;
            }

            console.log("📦 Resposta da API:", body);

            let pixFound = false;

            // Popula o código PIX se disponível
            if (body?.pix?.payload) {
                console.log("✅ Dados do PIX encontrados na API.");
                const pixPayload = body.pix.payload;
                
                if (elements.pixKey) elements.pixKey.value = pixPayload;
                if (elements.pixRaw) elements.pixRaw.value = pixPayload;
                
                // Usa o QR Code da API se disponível, senão gera um
                if (elements.qrImage) {
                    if (body.pix.qr_code_base64) {
                        elements.qrImage.src = body.pix.qr_code_base64;
                        console.log("📷 Usando QR Code da API");
                    } else {
                        elements.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(pixPayload)}`;
                        console.log("📷 Gerando QR Code via api.qrserver.com");
                    }
                    elements.qrImage.alt = 'QR Code PIX - Pronto para escanear';
                }
                
                if (elements.openAppBtn) {
                    elements.openAppBtn.href = pixPayload;
                }
                
                // Habilita botão de copiar
                enableCopyButton(true);
                pixFound = true;
            } else {
                console.warn("⚠️ Código PIX não encontrado na resposta da API");
                showValidationAlert('Aguardando geração do código PIX...');
            }

            // Popula o valor - usa da API ou da URL como fallback
            let amountSet = false;
            if (body?.amount) {
                if (elements.amountLabel) {
                    // Se amount for string "190", converte para 1.90
                    const amount = typeof body.amount === 'string' 
                        ? parseFloat(body.amount) / 100 
                        : body.amount;
                    elements.amountLabel.textContent = formatBRL(amount);
                    amountSet = true;
                    console.log(`💰 Valor definido da API: ${formatBRL(amount)}`);
                }
            }
            
            // Fallback: usa o valor da URL se a API não retornou
            if (!amountSet && urlParams.valor) {
                const valorFromUrl = parseFloat(urlParams.valor);
                if (!isNaN(valorFromUrl) && elements.amountLabel) {
                    elements.amountLabel.textContent = formatBRL(valorFromUrl);
                    console.log(`💰 Usando valor da URL como fallback: ${formatBRL(valorFromUrl)}`);
                }
            }

            // Popula ID do pedido se disponível
            if (body?.orderId || body?.id || body?.transactionId || body?.hash) {
                const orderId = body.orderId || body.id || body.transactionId || body.hash;
                if (elements.orderIdDisplay) {
                    // Se for um hash completo, mostra só os primeiros 8 caracteres
                    const displayId = orderId.length > 12 
                        ? orderId.substring(0, 8).toUpperCase() 
                        : orderId;
                    elements.orderIdDisplay.textContent = `#${displayId}`;
                    console.log(`🔖 ID do pedido: #${displayId}`);
                }
            }

            return { success: true, pixFound, body };

        } catch (error) {
            console.error('❌ Falha ao buscar detalhes do PIX:', error);
            showGenericError(error.message);
            return { success: false, error };
        }
    }

    /**
     * Mostra erro genérico
     */
    function showGenericError(details = '') {
        updateStatusBox('error', 'Erro ao carregar dados', 'Tente novamente em alguns instantes.');
        showSpinner(false);
        
        if (details) {
            console.error('Detalhes do erro:', details);
        }
    }

    // --- LÓGICA DE POLLING DE STATUS ---

    /**
     * Lógica de polling para verificar o status do pagamento
     */
    async function startPolling(hash) {
        if (elements.confirmBtn) elements.confirmBtn.disabled = true;
        
        updateStatusBox(null, 'Verificando...', 'Consultando status do pagamento...');
        showSpinner(true);

        for (let attempt = 1; attempt <= CONFIG.POLLING_MAX_ATTEMPTS; attempt++) {
            // Aguarda antes de cada tentativa (exceto a primeira)
            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_DELAY));
            }

            // Mostra progresso
            showPollingProgress(attempt, CONFIG.POLLING_MAX_ATTEMPTS);

            try {
                const url = new URL(CONFIG.CHECK_URL);
                url.searchParams.set(CONFIG.CHECK_PARAM, hash);
                
                const response = await fetch(url.toString(), { 
                    method: 'GET', 
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error(`Erro na API: ${response.status}`);
                }

                const data = await response.json();
                
                // A API pode retornar: { body: {...} } ou diretamente {...}
                let body;
                if (Array.isArray(data) && data.length > 0) {
                    body = data[0].body || data[0];
                } else {
                    body = data.body || data;
                }

                const status = (body?.status || 'unknown').toLowerCase();

                console.log(`🔍 Tentativa ${attempt}/${CONFIG.POLLING_MAX_ATTEMPTS} - Status: ${status}`);

                // SUCESSO: Pagamento confirmado
                if (/(paid|pago|confirmed|approved)/.test(status)) {
                    console.log("✅ Pagamento confirmado!");
                    hidePollingProgress();
                    handlePaidAndRedirect(body);
                    return;
                }

                // PENDENTE: Ainda não foi pago
                if (/(waiting|pending|waiting_payment|pendente|active)/.test(status)) {
                    updateStatusBox(
                        null,
                        'Aguardando pagamento',
                        'Pagamento ainda não confirmado. Por favor, conclua o pagamento no app.'
                    );
                    continue; // Próxima tentativa
                }

                // EXPIRADO/REJEITADO: Pagamento falhou
                if (/(expired|vencido|failed|rejected|cancelled|canceled)/.test(status)) {
                    console.log("⚠️ Pagamento expirado ou rejeitado");
                    hidePollingProgress();
                    updateStatusBox(
                        'expired',
                        'PIX Expirado',
                        'O tempo para pagamento expirou. Gere um novo PIX.'
                    );
                    showSpinner(false);
                    if (elements.confirmBtn) elements.confirmBtn.disabled = true;
                    return;
                }

                // Status desconhecido - continua tentando
                console.warn(`⚠️ Status desconhecido: ${status}`);

            } catch (error) {
                console.error(`❌ Erro na tentativa ${attempt}:`, error);
                
                // Se for a última tentativa, mostra erro
                if (attempt === CONFIG.POLLING_MAX_ATTEMPTS) {
                    hidePollingProgress();
                    updateStatusBox(
                        'error',
                        'Erro na verificação',
                        'Não foi possível verificar o pagamento. Tente novamente.'
                    );
                    showSpinner(false);
                    if (elements.confirmBtn) elements.confirmBtn.disabled = false;
                    return;
                }
                // Caso contrário, continua tentando
            }
        }

        // Fim do polling sem sucesso
        console.log("⏱️ Fim do polling - Pagamento não confirmado");
        hidePollingProgress();
        updateStatusBox(
            null,
            'Verificação finalizada',
            'Não foi possível confirmar o pagamento automaticamente. Verifique no app ou tente novamente.'
        );
        showSpinner(false);
        if (elements.confirmBtn) elements.confirmBtn.disabled = false;
    }

    // --- LÓGICA DE REDIRECIONAMENTO ---

    /**
     * Redireciona para a página de sucesso
     */
    function handlePaidAndRedirect(transactionData) {
        updateStatusBox('success', 'Pagamento Confirmado! ✅', 'Redirecionando para página de sucesso...');
        showSpinner(false);
        
        // Foca no elemento de status para leitores de tela
        try {
            if (elements.statusTitle?.focus) {
                elements.statusTitle.focus();
            }
        } catch (e) {
            console.warn('Não foi possível focar no status:', e);
        }

        // Redireciona após delay
        setTimeout(() => {
            const currentParams = new URLSearchParams(window.location.search);
            window.location.href = `${CONFIG.SUCCESS_URL}?${currentParams.toString()}`;
        }, CONFIG.REDIRECT_DELAY);
    }

    // --- LÓGICA DO COUNTDOWN ---

    /**
     * Countdown para expiração do PIX
     */
    function startCountdown(seconds = CONFIG.COUNTDOWN_SECONDS) {
        if (!elements.countdownEl) return;
        
        let timeRemaining = seconds;
        
        const interval = setInterval(() => {
            const minutes = Math.floor(timeRemaining / 60);
            const secs = timeRemaining % 60;
            
            elements.countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            
            // Muda cor quando faltam 2 minutos
            if (timeRemaining <= 120 && timeRemaining > 60) {
                elements.countdownEl.style.color = 'var(--color-warning)';
            }
            
            // Muda cor quando falta 1 minuto
            if (timeRemaining <= 60) {
                elements.countdownEl.style.color = 'var(--color-danger)';
            }
            
            if (timeRemaining <= 0) {
                clearInterval(interval);
                elements.countdownEl.textContent = 'EXPIRADO';
                elements.countdownEl.style.color = 'var(--color-danger)';
                
                updateStatusBox('expired', 'PIX Expirado', 'Tempo esgotado. Gere um novo código PIX.');
                
                if (elements.confirmBtn) elements.confirmBtn.disabled = true;
                if (elements.copyPrimary) elements.copyPrimary.disabled = true;
            }
            
            timeRemaining--;
        }, 1000);
        
        return interval;
    }

    // --- EVENT LISTENERS ---

    /**
     * Configura todos os event listeners
     */
    function setupEventListeners() {
        // Botão de Cópia Principal
        if (elements.copyPrimary) {
            elements.copyPrimary.addEventListener('click', async () => {
                const text = elements.pixKey?.value || elements.pixRaw?.value || '';
                
                if (!text) {
                    alert('❌ Nenhum código PIX disponível para copiar');
                    return;
                }
                
                const success = await copyToClipboard(text);
                
                if (success) {
                    showCopyMessage(elements.copiedMsgTop);
                    console.log('✅ Código PIX copiado');
                } else {
                    alert('❌ Não foi possível copiar automaticamente. Selecione e copie manualmente:\n\n' + text);
                }
            });
        }

        // Campo de texto PIX (clicar para copiar)
        if (elements.pixRaw) {
            elements.pixRaw.addEventListener('click', async () => {
                const text = elements.pixRaw.value || elements.pixKey?.value || '';
                
                if (!text) return;
                
                const success = await copyToClipboard(text);
                if (success) {
                    showCopyMessage(elements.copiedMsgStatus);
                }
            });
        }

        // Botão para abrir no app
        if (elements.openAppBtn) {
            elements.openAppBtn.addEventListener('click', (ev) => {
                const href = elements.openAppBtn.getAttribute('href') || '#';
                
                if (href === '#' || href.trim() === '') {
                    ev.preventDefault();
                    alert('⚠️ Link do aplicativo não disponível. Use o QR Code ou o código PIX.');
                }
            });
        }

        // Botão de Confirmação de Pagamento
        if (elements.confirmBtn) {
            elements.confirmBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                
                const hash = getUrlParams().hash || '';
                
                if (!hash) {
                    updateStatusBox('error', 'Erro', 'Código de verificação não encontrado.');
                    return;
                }
                
                if (!isValidHash(hash)) {
                    updateStatusBox('error', 'Erro', 'Código de verificação inválido.');
                    return;
                }
                
                await startPolling(hash);
            });
        }
    }

    // --- INICIALIZAÇÃO ---

    /**
     * Função principal de inicialização
     */
    (async function initialize() {
        console.log('🚀 Inicializando página de checkout PIX...');
        
        const params = getUrlParams();
        const hash = params.hash || '';

        // Esconde alertas de erro inicialmente
        if (elements.noHashError) elements.noHashError.classList.add('hidden');
        if (elements.invalidHashError) elements.invalidHashError.classList.add('hidden');
        if (elements.mainContent) elements.mainContent.classList.add('hidden');

        // CASO 1: Nenhum hash fornecido
        if (!hash) {
            console.error("❌ Nenhum hash encontrado na URL");
            if (elements.initialLoading) elements.initialLoading.style.display = 'none';
            if (elements.noHashError) elements.noHashError.classList.remove('hidden');
            return;
        }

        // CASO 2: Hash inválido
        if (!isValidHash(hash)) {
            console.error("❌ Hash inválido:", hash);
            if (elements.initialLoading) elements.initialLoading.style.display = 'none';
            if (elements.invalidHashError) elements.invalidHashError.classList.remove('hidden');
            return;
        }

        // CASO 3: Hash válido - Busca dados
        console.log("✅ Hash válido encontrado:", hash.substring(0, 8) + '...');
        
        try {
            // Mostra loading
            if (elements.initialLoading) elements.initialLoading.style.display = 'flex';
            
            // Busca dados do PIX
            const result = await fetchAndPopulatePix(hash, params);
            
            // Esconde loading
            if (elements.initialLoading) elements.initialLoading.style.display = 'none';
            
            if (result.success) {
                // Mostra conteúdo principal
                if (elements.mainContent) elements.mainContent.classList.remove('hidden');
                
                // Inicia countdown
                startCountdown();
                
                // Configura event listeners
                setupEventListeners();
                
                console.log("✅ Página carregada com sucesso!");
            } else {
                // Mostra erro
                if (elements.noHashError) elements.noHashError.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error("❌ Erro na inicialização:", error);
            if (elements.initialLoading) elements.initialLoading.style.display = 'none';
            if (elements.noHashError) elements.noHashError.classList.remove('hidden');
        }
    })();

})(document, window);
