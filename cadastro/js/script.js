document.addEventListener("DOMContentLoaded", function() {

    // --- SELETOres DO DOM ---
    const form = document.getElementById('form-captura');
    const nomeInput = document.getElementById('nome');
    const emailInput = document.getElementById('email');
    const celularInput = document.getElementById('celular');
    const cpfInput = document.getElementById('cpf');
    const btnSubmit = document.getElementById('liberar-acesso');
    const msgErro = document.getElementById('msg-erro');

    // --- FUNÇÕES DE MÁSCARA ---
    function mascaraCelular(valor) {
        valor = valor.replace(/\D/g, "");
        valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
        valor = valor.replace(/(\d)(\d{4})$/, "$1-$2");
        return valor;
    }

    function mascaraCpf(valor) {
        valor = valor.replace(/\D/g, "");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        return valor;
    }

    // --- FUNÇÕES DE LOCAL STORAGE ---
    const formFields = {
        nome: nomeInput,
        email: emailInput,
        celular: celularInput,
        cpf: cpfInput
    };

    // Salva os dados do formulário no localStorage
    function saveFormData() {
        Object.keys(formFields).forEach(key => {
            if (formFields[key]) {
                localStorage.setItem(`form_${key}`, formFields[key].value);
            }
        });
    }

    // Carrega os dados do formulário do localStorage
    function loadFormData() {
        Object.keys(formFields).forEach(key => {
            const savedValue = localStorage.getItem(`form_${key}`);
            if (savedValue && formFields[key]) {
                formFields[key].value = savedValue;
            }
        });
    }

    // Limpa os dados do formulário do localStorage (função mantida, mas não chamada)
    function clearFormData() {
        Object.keys(formFields).forEach(key => {
            localStorage.removeItem(`form_${key}`);
        });
    }

    // --- INICIALIZAÇÃO ---
    // 1. Carrega dados salvos ao abrir a página
    loadFormData();

    // 2. Adiciona listeners para salvar a cada digitação
    Object.values(formFields).forEach(input => {
        if (input) {
            input.addEventListener('input', saveFormData);
        }
    });

    // 3. Aplica máscaras específicas
    celularInput.addEventListener('input', function(e) {
        e.target.value = mascaraCelular(e.target.value);
    });

    cpfInput.addEventListener('input', function(e) {
        e.target.value = mascaraCpf(e.target.value);
    });

    // --- LÓGICA DE ENVIO DO FORMULÁRIO ---
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const celular = celularInput.value.trim();
            const cpf = cpfInput.value.trim();

            // Estados de UI
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="btn-text">Enviando...</span> <i class="fas fa-spinner fa-spin"></i>';
            msgErro.classList.add('hidden');

            // --- CAPTURA DE PARÂMETROS DA URL E LOCAL STORAGE (sem alterações) ---
            const parametrosDesejados = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid', 'xcod', 'sck', 'src', 'click_id', 'cid'];
            const urlParams = new URLSearchParams(window.location.search);
            const utms = {};
            parametrosDesejados.forEach(param => {
                if (urlParams.has(param)) utms[param] = urlParams.get(param);
            });
            parametrosDesejados.forEach(param => {
                if (!utms[param]) {
                    const val = localStorage.getItem(param);
                    const exp = localStorage.getItem(param + '_exp');
                    if (val && exp && Date.now() < +exp) utms[param] = val;
                }
            });
            if (!utms.utm_term) {
                function getCookie(nome) {
                    const valor = `; ${document.cookie}`;
                    const partes = valor.split(`; ${nome}=`);
                    if (partes.length === 2) return partes.pop().split(';').shift();
                }
                const utmTermCookie = getCookie("Leadsf");
                if (utmTermCookie) utms.utm_term = utmTermCookie;
            }
            if (!utms.utm_source) {
                const referrer = document.referrer;
                if (referrer) {
                    try {
                        const hostname = new URL(referrer).hostname.replace(/^www\./, '');
                        utms.utm_source = hostname;
                    } catch (e) {
                        utms.utm_source = "direto";
                    }
                } else {
                    utms.utm_source = "direto";
                }
            }

            // --- ENVIO PARA O WEBHOOK ---
            const payload = {
                nome, email, celular, cpf,
                referrer: document.referrer,
                url: window.location.href,
                ...utms
            };

            try {
                const resp = await fetch('https://webhook.msgagenciadigital.com/webhook/desafio-agenda', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (resp.ok) {
                    // --- REDIRECIONAMENTO PARA O CHECKOUT (COM PARÂMETROS CORRIGIDOS) ---
                    const checkoutBaseUrl = form.dataset.checkout;
                    // Linha corrigida
                    let redirectUrl = new URL(checkoutBaseUrl, window.location.origin);
                    
                    // PARÂMETROS ATUALIZADOS CONFORME REQUISITO DO CHECKOUT
                    redirectUrl.searchParams.set('cust_name', nome); // Alterado de 'nome'
                    redirectUrl.searchParams.set('email', email);     // Mantido 'email'
                    redirectUrl.searchParams.set('phone', celular);  // Alterado de 'celular'
                    redirectUrl.searchParams.set('document', cpf);   // Alterado de 'cpf'

                    // Os UTMs continuam sendo passados normalmente
                    Object.entries(utms).forEach(([k, v]) => {
                        if(v) redirectUrl.searchParams.set(k, v);
                    });

                    window.location.href = redirectUrl.toString();

                } else {
                    throw new Error('Falha no envio para o webhook.');
                }
            } catch (err) {
                console.error(err);
                msgErro.textContent = "Ocorreu um erro ao enviar. Tente novamente em alguns instantes.";
                msgErro.classList.remove('hidden');
                
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<span class="btn-text">LIBERAR MEU ACESSO AGORA</span> <i class="fas fa-arrow-right"></i>';
            }
        });
    }
});
