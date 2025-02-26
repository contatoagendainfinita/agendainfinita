// Script FAQ
function toggleFaq(id) {
    const answer = document.getElementById('faq' + id);
    answer.classList.toggle('hidden');
}

// Script Data atual

function getCurrentDate() {
    const today = new Date();
    return `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
}
document.getElementById("current-date").innerText = getCurrentDate();

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