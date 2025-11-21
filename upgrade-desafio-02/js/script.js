document.addEventListener("DOMContentLoaded", function() {

    // --- SCRIPT 1: RASTREAMENTO UTM ---
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

    // --- SCRIPT 2: ATUALIZAR ANO NO FOOTER ---
    const yearEl = document.getElementById("year");
    if(yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});