/*
Arquivo: app.js
Local: /js/app.js
Descrição: PWA com popup de instalação controlado + fallback universal
*/

console.log('APP.JS ATUALIZADO');

//
const modal = document.getElementById('installModal');
const btnInstall = document.getElementById('installBtn');
const btnClose = document.getElementById('installClose');
const iosHint = document.getElementById('iosHint');

let deferredPrompt = null;

// Detecta se já está instalado
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Detecta iOS
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Abrir / fechar modal
function openModal() {
  if (!modal) return;
  modal.classList.add('is-open');
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('is-open');
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

// Guardar o evento do navegador
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Se instalou, some com o popup
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  closeModal();
});

// Mostrar popup sempre (se não estiver instalado)
window.addEventListener('load', () => {
  if (isInStandaloneMode()) return;
  openModal();

  // iOS: mostra dica
  if (isIOS() && iosHint) {
    iosHint.hidden = false;
  }
});

// Botão fechar
if (btnClose) {
  btnClose.addEventListener('click', closeModal);
}

// Botão instalar (sempre clicável)
if (btnInstall) {
  btnInstall.addEventListener('click', async () => {

    // Se o navegador permite o prompt oficial
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result && result.outcome === 'accepted') {
        closeModal();
      }

      deferredPrompt = null;
      return;
    }

    // Fallback universal
    if (isIOS()) {
      alert('No iPhone: toque em "Compartilhar" e depois em "Adicionar à Tela de Início".');
      return;
    }

    alert('Para instalar: toque no menu ⋮ do navegador e escolha "Instalar app".');
  });
}

