
// Scripts Utms
// Função para adicionar os parâmetros aos links
function adicionarParametrosAosLinks() {
    const urlParams = new URLSearchParams(window.location.search);

    const links = document.querySelectorAll('a');

    links.forEach(link =>  {
        const href = new URL(link.href);
        urlParams.forEach((value, key) => {
            href.searchParams.set(key, value);
        });
        link.href = href.toString();
    });
}

// Chamar a função ao carregar a página
document.addEventListener('DOMContentLoaded', adicionarParametrosAosLinks);