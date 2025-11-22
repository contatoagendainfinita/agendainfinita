// trakiefy-latest.js v1.0.0 - Seu Utmify 100% grátis e melhor que o original
// Cole no <head> da landing ou página de captura

(() => {
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','xcod','sck','src','click_id','cid'];
  const storage = localStorage;
  const expDays = 7 * 24 * 60 * 60 * 1000; // 7 dias

  // 1. Salva todos os parâmetros que chegaram na URL
  new URLSearchParams(location.search).forEach((value, key) => {
    if (keys.includes(key)) {
      storage.setItem(key, value);
      storage.setItem(key + '_exp', Date.now() + expDays);
    }
  });

  // 2. Codifica xcod/sck com caracteres invisíveis (igual Utmify, mas melhor)
  const encodeInvisible = (str) => str.replace(/[0-9a-f]/gi, c => String.fromCharCode(8203 + parseInt(c, 16)));

  // 3. Restaura UTM em todos os links + injeta xcod/sck no WhatsApp
  const restoreLinks = () => {
    document.querySelectorAll('a[href]').forEach(link => {
      if (!link.href || link.href.includes('mailto:') || link.href.includes('#')) return;

      try {
        const url = new URL(link.href);

        // Restaura UTM normais
        keys.forEach(key => {
          const val = storage.getItem(key);
          const exp = storage.getItem(key + '_exp');
          if (val && exp && Date.now() < +exp) {
            url.searchParams.set(key, val);
          }
        });

        // WhatsApp: injeta xcod/sck codificado no campo text
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

  // Executa agora + sempre que mudar o DOM
  restoreLinks();
  new MutationObserver(restoreLinks).observe(document.body, { childList: true, subtree: true });
  setTimeout(restoreLinks, 1500);
  setTimeout(restoreLinks, 4000);
})();