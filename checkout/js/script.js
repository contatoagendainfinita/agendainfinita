window.OFFERS = [
  { product_hash: "hmiiovlisz", offer_hash: "34pb63cfbf", title: "Sistemas LTDA", price: 1.90 }
];

document.addEventListener('DOMContentLoaded', () => {
  /********** CONFIG **********/
  const CREATE_URL = 'https://webhook.msgagenciadigital.com/webhook/api-woovi-checkout';
  const SAVE_FIELDS = ['nome','email','telefone','cpf'];
  const FIXED_FALLBACK_PRICE = 19.00; // usado se não houver offers na página
  /*****************************/

  const urlParams = new URLSearchParams(window.location.search);

  // grava UTMs vindas da URL em localStorage (opcional)
  const utmKeys = ['src','utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id'];
  utmKeys.forEach(k => {
    const v = urlParams.get(k);
    if (v) {
      try { localStorage.setItem(k, v); } catch(e){}
    }
  });

  // monta objeto utm (prefere querystring)
  function currentUtm() {
    const p = new URLSearchParams(window.location.search);
    return {
      src: p.get('src') || localStorage.getItem('src') || '',
      utm_source: p.get('utm_source') || localStorage.getItem('utm_source') || '',
      utm_medium: p.get('utm_medium') || localStorage.getItem('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || localStorage.getItem('utm_campaign') || '',
      utm_term: p.get('utm_term') || localStorage.getItem('utm_term') || '',
      utm_content: p.get('utm_content') || localStorage.getItem('utm_content') || '',
      utm_id: p.get('utm_id') || localStorage.getItem('utm_id') || ''
    };
  }

  // Helpers DOM / masks
  function setIfExists(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    if (window.__masks) {
      if (id === 'cpf' && window.__masks.cpf) window.__masks.cpf.updateValue();
      if (id === 'telefone' && window.__masks.tel) window.__masks.tel.updateValue();
    }
  }

  // restore saved fields
  SAVE_FIELDS.forEach(id => {
    try {
      const v = localStorage.getItem(id);
      if (v) setIfExists(id, v);
    } catch(e){}
  });

  // prefill from querystring (no save)
  ['nome','email','telefone','cpf'].forEach(id => {
    const v = urlParams.get(id);
    if (v) setIfExists(id, v);
  });

  // save while typing
  SAVE_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      const v = (e.target.value || '').trim();
      try {
        if (v) localStorage.setItem(id, v);
        else localStorage.removeItem(id);
      } catch(e){}
    });
  });

  // IMask setup (if library present)
  window.__masks = window.__masks || {};
  if (window.IMask) {
    const cpfEl = document.getElementById('cpf');
    const telEl = document.getElementById('telefone');
    if (cpfEl) { const m = IMask(cpfEl, {mask:'000.000.000-00'}); m.updateValue(); window.__masks.cpf = m; }
    if (telEl) { const m2 = IMask(telEl, {mask:'(00) 00000-0000'}); m2.updateValue(); window.__masks.tel = m2; }
  }

  // countdown
  (function countdown(seconds = 15*60){
    let t = seconds;
    function tick(){
      const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
      if (document.getElementById('hours')) document.getElementById('hours').innerHTML = `${String(h).padStart(2,'0')} <span class="text-black text-xs block font-normal">Horas</span>`;
      if (document.getElementById('minutes')) document.getElementById('minutes').innerHTML = `${String(m).padStart(2,'0')} <span class="text-black text-xs block font-normal">Minutos</span>`;
      if (document.getElementById('seconds')) document.getElementById('seconds').innerHTML = `${String(s).padStart(2,'0')} <span class="text-black text-xs block font-normal">Segundos</span>`;
      if (t>0) t--; else clearInterval(interval);
    }
    tick();
    const interval = setInterval(tick, 1000);
  })();

  // safe getter for nested
  function safeGet(obj, path) {
    try {
      const parts = Array.isArray(path) ? path : String(path).split('.');
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return null;
        if (/^\d+$/.test(p)) cur = cur[Number(p)];
        else cur = cur[p];
      }
      return cur;
    } catch(e){ return null; }
  }

  // read offers from page: (1) window.OFFERS array OR (2) input#offersData with JSON string
  function readOffersFromPage() {
    try {
      if (Array.isArray(window.OFFERS) && window.OFFERS.length>0) return window.OFFERS;
      const el = document.getElementById('offersData');
      if (el && el.value) {
        const parsed = JSON.parse(el.value);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e){}
    return null;
  }

  // normalize price to float reais
  function parsePriceToReais(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    // if it looks like an integer cents (e.g. 500) we assume cents if large? keep simple: if contains '.' or ',' treat float; else integer -> cents
    if (/[.,]/.test(s)) {
      const norm = s.replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'');
      const f = parseFloat(norm);
      return isNaN(f) ? 0 : f;
    }
    // only digits -> treat as centavos (500 -> 5.00)
    const digits = s.replace(/\D/g,'');
    if (!digits) return 0;
    const n = Number(digits);
    if (isNaN(n)) return 0;
    return (n / 100);
  }

  // build customer URL: only hash + valor + allowed utms
  function buildCustomerUrl(hash, valorReais) {
    const q = new URLSearchParams();
    q.set('hash', String(hash));
    if (valorReais) q.set('valor', String(valorReais));
    const allowed = ['src','utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id'];
    allowed.forEach(k => {
      const v = (new URLSearchParams(window.location.search)).get(k) || localStorage.getItem(k);
      if (v) q.set(k, v);
    });
    return `../customer/?${q.toString()}`;
  }

  // SUBMIT
  document.getElementById('checkoutForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payBtn = document.getElementById('payBtn');
    const formError = document.getElementById('formError');
    formError.classList.add('hidden');
    payBtn.disabled = true;
    const originalText = payBtn.textContent;
    payBtn.textContent = 'Gerando cobrança...';

    // sync masks
    try {
      if (window.__masks && window.__masks.tel && typeof window.__masks.tel.updateValue === 'function') window.__masks.tel.updateValue();
      if (window.__masks && window.__masks.cpf && typeof window.__masks.cpf.updateValue === 'function') window.__masks.cpf.updateValue();
    } catch(e){}

    // read inputs
    const nome = (document.getElementById('nome')?.value || '').trim();
    const email = (document.getElementById('email')?.value || '').trim();
    let telefone = document.getElementById('telefone')?.value || '';
    let cpf = document.getElementById('cpf')?.value || '';

    if (window.__masks && window.__masks.tel && window.__masks.tel.unmaskedValue !== undefined) telefone = window.__masks.tel.unmaskedValue;
    else telefone = String(telefone).replace(/\D/g,'');

    if (window.__masks && window.__masks.cpf && window.__masks.cpf.unmaskedValue !== undefined) cpf = window.__masks.cpf.unmaskedValue;
    else cpf = String(cpf).replace(/\D/g,'');

    // persist simple fields
    try { if (nome) localStorage.setItem('nome', nome); if (email) localStorage.setItem('email', email); if (telefone) localStorage.setItem('telefone', telefone); } catch(e){}

    if (!nome || !email) {
      formError.textContent = 'Preencha nome e e-mail.';
      formError.classList.remove('hidden');
      payBtn.disabled = false;
      payBtn.textContent = originalText;
      return;
    }

    const utm = currentUtm();

    // read offers from page if present
    const pageOffersRaw = readOffersFromPage(); // expected [{hash:, title:, price:}]
    let offers = null;
    if (pageOffersRaw && pageOffersRaw.length > 0) {
      offers = pageOffersRaw.map(o => ({
        hash: o.hash || o.offer_hash || null,
        title: o.title || o.name || '',
        price: parsePriceToReais(o.price)
      }));
    }

    // compute totalAmount: prefer offers sum, else fallback fixed price
    let totalAmount = FIXED_FALLBACK_PRICE;
    if (offers && offers.length>0) {
      const sum = offers.reduce((s,it) => s + (Number(it.price)||0), 0);
      totalAmount = sum || totalAmount;
    }

        // --- montar payload para worker (COM HASHs da oferta/produto) ---
    // offers[] já foi lido antes (se existir) e contém objetos { hash, title, price }
    const payload = {
      customerData: {
        name: nome,
        email: email,
        phone: String(telefone).replace(/\D/g,''),
        cpf: String(cpf).replace(/\D/g,'')
      },
      // mainProduct: sempre envie name, price (em reais, number), hash e offer_hash quando disponíveis
      mainProduct: {
        name: (offers && offers[0] && (offers[0].title || offers[0].name)) ? (offers[0].title || offers[0].name) : 'Liberar Acesso',
        price: (offers && offers[0] && typeof offers[0].price === 'number') ? Number(offers[0].price) : Number(totalAmount),
        // preencher hash do produto (quando disponível na offers[0])
        hash: (offers && offers[0] && offers[0].product_hash) ? offers[0].product_hash : (offers && offers[0] && offers[0].hash) ? offers[0].hash : undefined,
        // preencher offer_hash (hash da oferta) quando disponível
        offer_hash: (offers && offers[0] && (offers[0].offer_hash || offers[0].hash)) ? (offers[0].offer_hash || offers[0].hash) : undefined
      },
      selectedBumps: [],
      totalAmount: Number(totalAmount), // sempre número em reais (ex: 19.90)
      paymentMethod: 'pix',
      tracking: utm
    };

    // se detectamos offers na página, envie o array coerente e garanta offer_hash no topo do payload
    if (offers && offers.length > 0) {
      // normalizar cada offer: { hash, title, price }
      payload.offers = offers.map(o => ({
        hash: o.hash || o.offer_hash || null,
        title: o.title || o.name || '',
        price: Number(o.price || 0)
      }));

      // preferir offer_hash explícito (offers[0].offer_hash) senão usar offers[0].hash
      const topOfferHash = (offers[0].offer_hash || offers[0].hash || null);
      if (topOfferHash) {
        payload.offer_hash = topOfferHash;
        // garantir também que mainProduct.offer_hash tenha valor
        payload.mainProduct.offer_hash = payload.mainProduct.offer_hash || topOfferHash;
      }

      // se product hash estiver em offers[0].product_hash, propaga também
      if (offers[0].product_hash) {
        payload.mainProduct.hash = payload.mainProduct.hash || offers[0].product_hash;
      }
    }


    // POST para o worker
    try {
      const resp = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = text; }

      if (!resp.ok) {
        console.error('Erro criando transação', resp.status, data);
        const msg = (typeof data === 'object' && data !== null && (data.message || data.error)) ? (data.message || data.error) : 'Erro ao criar cobrança.';
        formError.textContent = Array.isArray(msg) ? msg.join(', ') : String(msg);
        formError.classList.remove('hidden');
        payBtn.disabled = false;
        payBtn.textContent = originalText;
        return;
      }

      // normalizar root: worker pode enviar [ { body: {...} } ] ou { body: {...} } ou { ... }
      let root = data;
      if (Array.isArray(data) && data.length>0) {
        root = (data[0] && data[0].body) ? data[0].body : data[0];
      } else if (data && data.body) {
        root = data.body;
      }

      // O requisito: redirecionar SOMENTE se success:true e transaction.hash existe
      const successFlag = !!(root && root.success === true);
      const txHash = safeGet(root, ['transaction', 'hash']) ||  // ✅ CORRETO
                    safeGet(root, ['transaction', 'id']) ||     // ✅ CORRETO
                    safeGet(root, ['hash']) || 
                    safeGet(root, ['transaction_hash']) || null;

      // Logo após definir o 'root', adicione:
      console.log('ROOT completo:', JSON.stringify(root, null, 2));
      console.log('Transaction:', root?.transaction);

      if (!successFlag) {
        console.error('Worker não retornou success:true', root);
        formError.textContent = 'Não foi possível gerar o PIX (worker não retornou success:true). Contate o suporte.';
        formError.classList.remove('hidden');
        payBtn.disabled = false;
        payBtn.textContent = originalText;
        return;
      }

      if (!txHash) {
        console.error('Worker retornou success:true mas sem transaction.hash', root);
        formError.textContent = 'Transação criada sem identificador. Contate o suporte.';
        formError.classList.remove('hidden');
        payBtn.disabled = false;
        payBtn.textContent = originalText;
        return;
      }

      // extrair valor a ser enviado ao customer (prefer payload.totalAmount em REAIS)
      let valorReais = '0.00';
      if (payload && typeof payload.totalAmount === 'number') {
        valorReais = Number(payload.totalAmount).toFixed(2);
      } else {
        // procurar por amount no response (muitos providers retornam centavos)
        const candPaths = [
          ['transaction','amount'],
          ['amount'],
          ['raw','amount'],
          ['items','0','price'],
          ['offer','price']
        ];
        let found = null;
        for (const p of candPaths) {
          const v = safeGet(root, p);
          if (v !== null && v !== undefined) { found = v; break; }
        }
        if (found !== null) {
          const n = Number(found);
          if (!isNaN(n)) {
            valorReais = Number(Number.isInteger(n) ? (n/100) : n).toFixed(2);
          }
        }
      }

      // construir URL do customer -> APENAS hash + valor + UTMs (nunca incluir PIX/key)
      const finalUrl = buildCustomerUrl(txHash, valorReais);

      // salvar cpf local para conveniência
      try { if (cpf) localStorage.setItem('cpf', String(cpf)); } catch(e){}

      console.info('Redirecionando para customer:', finalUrl);
      location.replace(finalUrl);
      return;

    } catch (err) {
      console.error('Erro na requisição ao worker', err);
      formError.textContent = 'Erro de rede. Tente novamente.';
      formError.classList.remove('hidden');
      payBtn.disabled = false;
      payBtn.textContent = originalText;
      return;
    }
  });

});