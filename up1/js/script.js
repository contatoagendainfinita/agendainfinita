document.addEventListener("DOMContentLoaded", function() {

    // --- SCRIPT 1: ATUALIZAR ANO NO FOOTER ---
    const yearEl = document.getElementById("year");
    if(yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // --- SCRIPT 2: RASTREAMENTO UTM ---
    // O script já está no <head>, mas é bom lembrar que ele é essencial.
    // Ele garante que todos os parâmetros da URL de origem (ex: utm_source)
    // sejam passados para o link do checkout, mantendo o rastreamento da venda.
});