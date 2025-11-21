document.addEventListener("DOMContentLoaded", function() {

    // --- SCRIPT 1: DATA DINÂMICA ---
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const today = new Date().toLocaleDateString('pt-BR', options);
    const dataDinamicaEl = document.getElementById("data-dinamica");
    if (dataDinamicaEl) {
        dataDinamicaEl.textContent = today;
    }

    // --- SCRIPT 2: RASTREAMENTO UTM (DO <head>) ---
    (function() {
      const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','xcod','sck','src','click_id','cid'];
      const storage = localStorage;
      const expDays = 7 * 24 * 60 * 60 * 1000;

      new URLSearchParams(location.search).forEach((value, key) => {
        if (keys.includes(key)) {
          storage.setItem(key, value);
          storage.setItem(key + '_exp', Date.now() + expDays);
        }
      });

      const encodeInvisible = (str) => str.replace(/[0-9a-f]/gi, c => String.fromCharCode(8203 + parseInt(c, 16)));

      const restoreLinks = () => {
        document.querySelectorAll('a[href]').forEach(link => {
          if (!link.href || link.href.includes('mailto:') || link.href.includes('#')) return;
          try {
            const url = new URL(link.href);
            keys.forEach(key => {
              const val = storage.getItem(key);
              const exp = storage.getItem(key + '_exp');
              if (val && exp && Date.now() < +exp) {
                url.searchParams.set(key, val);
              }
            });
            if (url.hostname.includes('wa.me') || url.hostname.includes('api.whatsapp.com') || url.hostname.includes('chat.whatsapp.com')) {
              const clickId = storage.getItem('xcod') || storage.getItem('sck') || '';
              if (clickId) {
                const encoded = encodeInvisible(clickId);
                const currentText = url.searchParams.get('text') || 'Olá';
                url.searchParams.set('text', currentText + ' ' + encoded);
              }
            }
            link.href = url.toString();
          } catch (e) {}
        });
      };

      restoreLinks();
      new MutationObserver(restoreLinks).observe(document.body, { childList: true, subtree: true });
      setTimeout(restoreLinks, 1500);
      setTimeout(restoreLinks, 4000);
    })();

    // --- SCRIPT 3: ADICIONAR UTMS AOS LINKS (DO <body>) ---
    const links = document.querySelectorAll("a");
    const urlAtual = new URL(window.location.href);
    const searchParams = new URLSearchParams(urlAtual.search);
    const parametrosDesejados = ['px', 'src', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_perfect', 'click_id', 'fbclid'];

    function getCookie(nome) {
        const valor = `; ${document.cookie}`;
        const partes = valor.split(`; ${nome}=`);
        if (partes.length === 2) return partes.pop().split(';').shift();
    }

    function getPlatformName(hostname) {
        let partes = hostname.replace(/^www\./, '').split('.');
        if (partes.length > 2) partes = partes.slice(-2);
        const nome = partes[0];
        return nome.charAt(0).toUpperCase() + nome.slice(1);
    }

    if (!searchParams.has("utm_term")) {
        const utmTermCookie = getCookie("Leadsf");
        if (utmTermCookie) searchParams.set("utm_term", utmTermCookie);
    }

    if (!searchParams.has("utm_source")) {
        const referrer = document.referrer;
        if (referrer) {
            try {
                const hostname = new URL(referrer).hostname;
                const plataforma = getPlatformName(hostname);
                searchParams.set("utm_source", plataforma);
            } catch (e) {
                searchParams.set("utm_source", "direto");
            }
        } else {
            searchParams.set("utm_source", "direto");
        }
    }

    links.forEach(link => {
        const href = link.getAttribute("href");
        if (!href) return;
        if (href.includes("agendainfinita.website") || href.includes("greenn.com.br")) {
            const linkURL = new URL(href, window.location.origin);
            parametrosDesejados.forEach(chave => {
                if (searchParams.has(chave) && !linkURL.searchParams.has(chave)) {
                    linkURL.searchParams.set(chave, searchParams.get(chave));
                }
            });
            link.setAttribute("href", linkURL.toString());
        }
    });

    // --- SCRIPT 4: FAQ ACCORDION ---
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Fecha todos os outros itens
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            // Abre/fecha o item atual
            item.classList.toggle('active');
        });
    });

    // --- SCRIPT 5: ATUALIZAR ANO NO FOOTER ---
    const yearEl = document.getElementById("year");
    if(yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

});