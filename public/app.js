// Variáveis Globais de Estado

let searches = [];

let activeSearchId = null;

let activeSearchData = { results: [], logs: [] };

let eventSource = null;
let globalEventSource = null;

let searchSources = [];

let delugeOnline = false;

let delugeEventSource = null;

let delugeRemoveTargetId = null;
let delugeTorrentsCache = {};

// Função Utilitária para Sanitizar HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Elementos do DOM

const themeToggleBtn = document.getElementById('themeToggleBtn');

const sidebar = document.getElementById('sidebar');

const searchesList = document.getElementById('searchesList');

const newSearchBtn = document.getElementById('newSearchBtn');

const stopAllSearchesBtn = document.getElementById('stopAllSearchesBtn');

const restartAllSearchesBtn = document.getElementById('restartAllSearchesBtn');

const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');

const activeSearchQueryTitle = document.getElementById('activeSearchQueryTitle');

const mainContent = document.getElementById('mainContent');



// Seções principais

const newSearchSection = document.getElementById('newSearchSection');

const activeSearchSection = document.getElementById('activeSearchSection');

const settingsSection = document.getElementById('settingsSection');



// Formulários

const searchForm = document.getElementById('searchForm');

const queryInput = document.getElementById('queryInput');

const exampleBtns = document.querySelectorAll('.example-btn');

const settingsForm = document.getElementById('settingsForm');



// Abas de Configurações

const tabGeneralBtn = document.getElementById('tabGeneralBtn');

const tabSourcesBtn = document.getElementById('tabSourcesBtn');

const tabGeneralContent = document.getElementById('tabGeneralContent');

const tabSourcesContent = document.getElementById('tabSourcesContent');



// Elementos do CRUD de Fontes

const addSourceBtn = document.getElementById('addSourceBtn');

const importSourcesBtn = document.getElementById('importSourcesBtn');

const exportSourcesBtn = document.getElementById('exportSourcesBtn');

const sourcesTableBody = document.getElementById('sourcesTableBody');

const sourceModal = document.getElementById('sourceModal');

const sourceForm = document.getElementById('sourceForm');

const modalTitle = document.getElementById('modalTitle');

const closeModalBtn = document.getElementById('closeModalBtn');

const cancelModalBtn = document.getElementById('cancelModalBtn');

const optimizeSingleUrlBtn = document.getElementById('optimizeSingleUrlBtn');

// Variáveis de Otimização e Análise de IA
const optimizeAllSourcesBtn = document.getElementById('optimizeAllSourcesBtn');
const sourceAnalysisModal = document.getElementById('sourceAnalysisModal');
const closeAnalysisModalBtn = document.getElementById('closeAnalysisModalBtn');
const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
const applyAnalysisBtn = document.getElementById('applyAnalysisBtn');
const retryAnalysisBtn = document.getElementById('retryAnalysisBtn');

const analysisLoadingState = document.getElementById('analysisLoadingState');
const analysisResultState = document.getElementById('analysisResultState');
const analysisErrorState = document.getElementById('analysisErrorState');
const analysisStatusTitle = document.getElementById('analysisStatusTitle');
const analysisLogs = document.getElementById('analysisLogs');

// Variáveis do Teste de Conexão de IA
const testAiBtn = document.getElementById('testAiBtn');
const testAiModal = document.getElementById('testAiModal');
const closeTestAiModalBtn = document.getElementById('closeTestAiModalBtn');
const closeTestAiBtn = document.getElementById('closeTestAiBtn');
const testAiStatusContainer = document.getElementById('testAiStatusContainer');
const testAiSpinner = document.getElementById('testAiSpinner');
const testAiSuccessIcon = document.getElementById('testAiSuccessIcon');
const testAiErrorIcon = document.getElementById('testAiErrorIcon');
const testAiStatusTitle = document.getElementById('testAiStatusTitle');
const testAiStatusSubtitle = document.getElementById('testAiStatusSubtitle');
const testAiResponseContainer = document.getElementById('testAiResponseContainer');
const testAiResponseText = document.getElementById('testAiResponseText');
const testAiErrorContainer = document.getElementById('testAiErrorContainer');
const testAiErrorText = document.getElementById('testAiErrorText');
const testAiLogs = document.getElementById('testAiLogs');

const analysisSourceName = document.getElementById('analysisSourceName');
const analysisSourceUrl = document.getElementById('analysisSourceUrl');
const analysisStrategyBadge = document.getElementById('analysisStrategyBadge');
const analysisExplanation = document.getElementById('analysisExplanation');
const analysisPatternOld = document.getElementById('analysisPatternOld');
const analysisPatternNew = document.getElementById('analysisPatternNew');
const analysisDescription = document.getElementById('analysisDescription');
const analysisContentTypes = document.getElementById('analysisContentTypes');
const analysisErrorMsg = document.getElementById('analysisErrorMsg');

// Lote
const batchAnalysisModal = document.getElementById('batchAnalysisModal');
const closeBatchAnalysisModalBtn = document.getElementById('closeBatchAnalysisModalBtn');
const closeBatchBtn = document.getElementById('closeBatchBtn');
const batchProgressText = document.getElementById('batchProgressText');
const batchProgressBar = document.getElementById('batchProgressBar');
const batchSitesList = document.getElementById('batchSitesList');
const cancelBatchBtn = document.getElementById('cancelBatchBtn');



// Inputs do Modal de Fonte

const sourceIdInput = document.getElementById('sourceIdInput');

const sourceNameInput = document.getElementById('sourceNameInput');

const sourceUrlInput = document.getElementById('sourceUrlInput');

const sourcePatternInput = document.getElementById('sourcePatternInput');

const sourceDescriptionInput = document.getElementById('sourceDescriptionInput');

const sourceActiveInput = document.getElementById('sourceActiveInput');



// Elementos da Busca Ativa

const activeSearchTitle = document.getElementById('activeSearchTitle');

const activeSearchDate = document.getElementById('activeSearchDate');

const activeSearchStatusBadge = document.getElementById('activeSearchStatusBadge');

const activeSearchMetaBadge = document.getElementById('activeSearchMetaBadge');

const terminalLogs = document.getElementById('terminalLogs');

const clearLogsBtn = document.getElementById('clearLogsBtn');

const resultsCountBadge = document.getElementById('resultsCountBadge');

const torrentResultsGrid = document.getElementById('torrentResultsGrid');

const copyAllMagnetsBtn = document.getElementById('copyAllMagnetsBtn');



// Botões de Controle da Busca

const stopSearchBtn = document.getElementById('stopSearchBtn');

const resumeSearchBtn = document.getElementById('resumeSearchBtn');

const restartSearchBtn = document.getElementById('restartSearchBtn');



// Estatísticas

const statTotal = document.getElementById('statTotal');

const statCompleted = document.getElementById('statCompleted');

const statActive = document.getElementById('statActive');



// Elementos do Deluge

const sidebarDelugeBtn = document.getElementById('sidebarDelugeBtn');

const delugeStatusDot = document.getElementById('delugeStatusDot');

const downloadAllDelugeBtn = document.getElementById('downloadAllDelugeBtn');

const delugeSection = document.getElementById('delugeSection');

const refreshDelugeBtn = document.getElementById('refreshDelugeBtn');
const searchDelugeInput = document.getElementById('searchDelugeInput');
const clearDelugeErrorsBtn = document.getElementById('clearDelugeErrorsBtn');
const openAddDelugeUrlBtn = document.getElementById('openAddDelugeUrlBtn');

const delugeAddUrlModal = document.getElementById('delugeAddUrlModal');
const closeDelugeAddUrlModalBtn = document.getElementById('closeDelugeAddUrlModalBtn');
const cancelDelugeAddUrlBtn = document.getElementById('cancelDelugeAddUrlBtn');
const delugeAddUrlForm = document.getElementById('delugeAddUrlForm');
const delugeUrlInput = document.getElementById('delugeUrlInput');
const submitDelugeAddUrlBtn = document.getElementById('submitDelugeAddUrlBtn');
const delugeAddUrlStatus = document.getElementById('delugeAddUrlStatus');
const delugeMonitorCheck = document.getElementById('delugeMonitorCheck');

// Elementos de Páginas Monitoradas
const sidebarMonitoredBtn = document.getElementById('sidebarMonitoredBtn');
const monitoredSection = document.getElementById('monitoredSection');
const monitoredPagesList = document.getElementById('monitoredPagesList');
const monitoredCountBadge = document.getElementById('monitoredCountBadge');
const checkAllMonitoredBtn = document.getElementById('checkAllMonitoredBtn');
const addMonitoredPageBtn = document.getElementById('addMonitoredPageBtn');

const delugePanelStatusBadge = document.getElementById('delugePanelStatusBadge');

const delugePanelOfflineAlert = document.getElementById('delugePanelOfflineAlert');

const delugeTorrentsContainer = document.getElementById('delugeTorrentsContainer');

const delugeRemoveModal = document.getElementById('delugeRemoveModal');

const closeDelugeRemoveModalBtn = document.getElementById('closeDelugeRemoveModalBtn');

const delugeRemoveKeepDataBtn = document.getElementById('delugeRemoveKeepDataBtn');

const delugeRemoveDeleteDataBtn = document.getElementById('delugeRemoveDeleteDataBtn');

const delugeRemoveCancelBtn = document.getElementById('delugeRemoveCancelBtn');

const delugeRemoveTorrentName = document.getElementById('delugeRemoveTorrentName');



// Stats do Deluge

const delugeStatTotal = document.getElementById('delugeStatTotal');

const delugeStatDownloading = document.getElementById('delugeStatDownloading');

const delugeStatDlSpeed = document.getElementById('delugeStatDlSpeed');

const delugeStatUlSpeed = document.getElementById('delugeStatUlSpeed');



// Sobrescreve alert e confirm globais para usar o Modal Customizado com foco inicial
function setupCustomDialogs() {
  const modal = document.getElementById('customDialogModal');
  const titleEl = document.getElementById('customDialogTitle');
  const messageEl = document.getElementById('customDialogMessage');
  const confirmBtn = document.getElementById('customDialogConfirmBtn');
  const cancelBtn = document.getElementById('customDialogCancelBtn');
  const closeBtn = document.getElementById('customDialogCloseBtn');

  let activeResolve = null;

  function showDialog(type, message, customTitle) {
    return new Promise((resolve) => {
      activeResolve = resolve;
      messageEl.innerText = message;

      if (type === 'confirm') {
        titleEl.innerHTML = '<i class="ph-bold ph-question text-brand-500 text-lg"></i> <span>' + (customTitle || 'Confirmação') + '</span>';
        cancelBtn.classList.remove('hidden');
        confirmBtn.innerText = 'Confirmar';
        confirmBtn.className = "py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-md shadow-brand-500/10 hover:shadow-lg transition-all focus:outline-none min-w-[80px]";
      } else {
        titleEl.innerHTML = '<i class="ph-bold ph-info text-blue-500 text-lg"></i> <span>' + (customTitle || 'Aviso') + '</span>';
        cancelBtn.classList.add('hidden');
        confirmBtn.innerText = 'OK';
        confirmBtn.className = "py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-md shadow-brand-500/10 hover:shadow-lg transition-all focus:outline-none min-w-[80px]";
      }

      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        confirmBtn.focus();
      }, 50);
    });
  }

  function closeDialog(value) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (activeResolve) {
      activeResolve(value);
      activeResolve = null;
    }
  }

  confirmBtn.onclick = () => closeDialog(true);
  cancelBtn.onclick = () => closeDialog(false);
  closeBtn.onclick = () => closeDialog(false);

  modal.onclick = (e) => {
    if (e.target === modal) {
      closeDialog(false);
    }
  };

  window.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        closeDialog(false);
        e.preventDefault();
      }
    }
  });

  window.alert = (message, title) => showDialog('alert', message, title);
  window.confirm = (message, title) => showDialog('confirm', message, title);
}

// --- INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', () => {
  setupCustomDialogs();

  // Inicialização de Tema Claro/Escuro
  const savedTheme = localStorage.getItem('theme') || 'dark';

  if (savedTheme === 'dark') {

    document.documentElement.classList.add('dark');

  } else {

    document.documentElement.classList.remove('dark');

  }



  // Carrega buscas iniciais

  fetchSearches();
  connectGlobalSSE();

  checkDelugeStatus();



  // Event Listeners Gerais

  themeToggleBtn.addEventListener('click', toggleTheme);

  sidebarDelugeBtn.addEventListener('click', showDelugeSection);
  if (sidebarMonitoredBtn) sidebarMonitoredBtn.addEventListener('click', showMonitoredSection);
  if (checkAllMonitoredBtn) checkAllMonitoredBtn.addEventListener('click', handleCheckAllMonitoredPages);
  if (addMonitoredPageBtn) addMonitoredPageBtn.addEventListener('click', openDelugeAddUrlModal);

  refreshDelugeBtn.addEventListener('click', fetchDelugeTorrents);

  downloadAllDelugeBtn.addEventListener('click', downloadAllTorrentsInDeluge);
  searchDelugeInput.addEventListener('input', () => renderDelugeTorrents(delugeTorrentsCache));
  clearDelugeErrorsBtn.addEventListener('click', clearDelugeErrors);

  if (openAddDelugeUrlBtn) openAddDelugeUrlBtn.addEventListener('click', openDelugeAddUrlModal);
  if (closeDelugeAddUrlModalBtn) closeDelugeAddUrlModalBtn.addEventListener('click', closeDelugeAddUrlModal);
  if (cancelDelugeAddUrlBtn) cancelDelugeAddUrlBtn.addEventListener('click', closeDelugeAddUrlModal);
  if (delugeAddUrlForm) delugeAddUrlForm.addEventListener('submit', handleDelugeAddUrlSubmit);

  closeDelugeRemoveModalBtn.addEventListener('click', closeDelugeRemoveModal);

  delugeRemoveCancelBtn.addEventListener('click', closeDelugeRemoveModal);

  delugeRemoveKeepDataBtn.addEventListener('click', () => confirmRemoveTorrent(false));

  delugeRemoveDeleteDataBtn.addEventListener('click', () => confirmRemoveTorrent(true));

  newSearchBtn.addEventListener('click', (e) => {
    showNewSearchForm(e);
    setTimeout(() => {
      const queryInput = document.getElementById('queryInput');
      if (queryInput) {
        queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        queryInput.focus();
      }
    }, 100);
  });

  if (stopAllSearchesBtn) {
    stopAllSearchesBtn.addEventListener('click', handleStopAllSearches);
  }

  if (restartAllSearchesBtn) {
    restartAllSearchesBtn.addEventListener('click', handleRestartAllSearches);
  }

  sidebarSettingsBtn.addEventListener('click', showSettingsSection);

  searchForm.addEventListener('submit', handleSearchSubmit);

  clearLogsBtn.addEventListener('click', () => { terminalLogs.innerHTML = ''; });

  

  stopSearchBtn.addEventListener('click', stopActiveSearch);

  resumeSearchBtn.addEventListener('click', () => restartActiveSearch(true));

  restartSearchBtn.addEventListener('click', () => restartActiveSearch(false));

  copyAllMagnetsBtn.addEventListener('click', copyAllMagnetLinks);



  // Navegação de Abas nas Configurações

  tabGeneralBtn.addEventListener('click', () => switchSettingsTab('general'));

  tabSourcesBtn.addEventListener('click', () => switchSettingsTab('sources'));

  

  // Submit de Formulários de Configurações
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => e.preventDefault());
  }

  const setDubladoBtn = document.getElementById('setDubladoBtn');
  if (setDubladoBtn) {
    setDubladoBtn.addEventListener('click', () => {
      const preferredAudioLanguage = document.getElementById('preferredAudioLanguage');
      if (preferredAudioLanguage) {
        preferredAudioLanguage.value = 'Português (Dublado)';
      }
      const preferredSubtitleLanguage = document.getElementById('preferredSubtitleLanguage');
      if (preferredSubtitleLanguage) {
        preferredSubtitleLanguage.value = 'Português (PT-BR)';
      }
    });
  }

  sourceForm.addEventListener('submit', handleSourceSubmit);



  // Controle do Modal de Fonte

  addSourceBtn.addEventListener('click', () => openSourceModal());

  importSourcesBtn.addEventListener('click', importSources);

  exportSourcesBtn.addEventListener('click', exportSources);

  closeModalBtn.addEventListener('click', closeSourceModal);

  cancelModalBtn.addEventListener('click', closeSourceModal);

  if (optimizeSingleUrlBtn) {
    optimizeSingleUrlBtn.addEventListener('click', () => {
      const url = sourceUrlInput.value.trim();
      const name = sourceNameInput.value.trim();
      if (!url) {
        showDelugeToast("Por favor, preencha a URL Base antes de otimizar.", "warning");
        sourceUrlInput.focus();
        return;
      }
      analyzeSourceUrl(url, name);
    });
  }

  // Ligações de Análise com IA
  if (optimizeAllSourcesBtn) {
    optimizeAllSourcesBtn.addEventListener('click', analyzeAllSources);
  }
  if (closeAnalysisModalBtn) {
    closeAnalysisModalBtn.addEventListener('click', () => cancelAnalysisAndClose());
  }
  if (cancelAnalysisBtn) {
    cancelAnalysisBtn.addEventListener('click', () => cancelAnalysisAndClose());
  }
  if (closeBatchAnalysisModalBtn) {
    closeBatchAnalysisModalBtn.addEventListener('click', () => cancelBatchAndClose());
  }
  if (closeBatchBtn) {
    closeBatchBtn.addEventListener('click', () => cancelBatchAndClose());
  }

  // Ligações de Teste de Conexão de IA
  if (testAiBtn) {
    testAiBtn.addEventListener('click', testAiConnection);
  }
  if (closeTestAiModalBtn) {
    closeTestAiModalBtn.addEventListener('click', () => testAiModal.classList.add('hidden'));
  }
  if (closeTestAiBtn) {
    closeTestAiBtn.addEventListener('click', () => testAiModal.classList.add('hidden'));
  }



  // Botões de Exemplos de Busca

  exampleBtns.forEach(btn => {

    btn.addEventListener('click', () => {

      queryInput.value = btn.innerText.trim();

      queryInput.focus();

    });

  });

  // Botões de Controle do Servidor
  const restartServerBtn = document.getElementById('restartServerBtn');
  const shutdownServerBtn = document.getElementById('shutdownServerBtn');
  if (restartServerBtn) {
    restartServerBtn.addEventListener('click', handleRestartServer);
  }
  if (shutdownServerBtn) {
    shutdownServerBtn.addEventListener('click', handleShutdownServer);
  }

});

// Controle do Servidor (Reiniciar / Desligar)
function logServerControlError(errorMsg) {
  const container = document.getElementById('serverControlLogContainer');
  const logDiv = document.getElementById('serverControlLogs');
  if (container && logDiv) {
    container.classList.remove('hidden');
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const logLine = document.createElement('div');
    logLine.className = "py-0.5 border-b border-red-500/10 dark:border-red-950/30 text-[11px] font-mono leading-relaxed text-red-650 dark:text-red-400";
    logLine.innerText = `[${time}] ${errorMsg}`;
    logDiv.appendChild(logLine);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

async function handleRestartServer() {
  if (!await confirm("Tem certeza que deseja REINICIAR a máquina? Todos os processos ativos serão finalizados.")) return;

  const btn = document.getElementById('restartServerBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Reiniciando...`;

  // Limpa logs de erro anteriores
  const logContainer = document.getElementById('serverControlLogContainer');
  const logDiv = document.getElementById('serverControlLogs');
  if (logContainer) logContainer.classList.add('hidden');
  if (logDiv) logDiv.innerHTML = '';

  try {
    const res = await fetch('/api/server/restart', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    
    await alert("A máquina está sendo reiniciada. A conexão com esta página será perdida.");
    setTimeout(() => {
      window.location.reload();
    }, 4000);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    logServerControlError("Erro ao reiniciar a máquina: " + err.message);
  }
}

async function handleShutdownServer() {
  if (!await confirm("Tem certeza que deseja DESLIGAR a máquina? A aplicação e a máquina deixarão de funcionar até que o botão físico de energia seja pressionado.")) return;

  const btn = document.getElementById('shutdownServerBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Desligando...`;

  // Limpa logs de erro anteriores
  const logContainer = document.getElementById('serverControlLogContainer');
  const logDiv = document.getElementById('serverControlLogs');
  if (logContainer) logContainer.classList.add('hidden');
  if (logDiv) logDiv.innerHTML = '';

  try {
    const res = await fetch('/api/server/shutdown', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    
    await alert("A máquina está sendo desligada. A conexão com esta página será perdida.");
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    logServerControlError("Erro ao desligar a máquina: " + err.message);
  }
}

async function handleStopAllSearches() {
  if (!await confirm("Tem certeza que deseja PARAR todas as buscas ativas e pendentes e fechar todos os navegadores?")) return;

  const btn = document.getElementById('stopAllSearchesBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> Parando...`;

  try {
    const res = await fetch('/api/searches/stop-all', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    
    // Recarrega a lista de buscas
    await fetchSearches();
    
    // Se a busca ativa no momento for uma das que parou, atualiza a UI dela
    if (activeSearchId) {
      await handleSearchClick(activeSearchId);
    }
    
  } catch (err) {
    await alert("Erro ao parar todas as buscas: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function handleRestartAllSearches() {
  if (!await confirm("Tem certeza que deseja reiniciar todas as buscas não concluídas? O processo será executado de forma sequencial (uma busca por vez).")) return;

  const btn = document.getElementById('restartAllSearchesBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> Reiniciando...`;

  try {
    const res = await fetch('/api/searches/restart-all', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    
    const result = await res.json();
    await alert(result.message || "Buscas reiniciadas com sucesso!");
    
    // Recarrega a lista de buscas
    await fetchSearches();
    
    if (activeSearchId) {
      await handleSearchClick(activeSearchId);
    }
    
  } catch (err) {
    await alert("Erro ao reiniciar buscas: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}




// Alterna tema

function toggleTheme() {

  const isDark = document.documentElement.classList.toggle('dark');

  localStorage.setItem('theme', isDark ? 'dark' : 'light');

}



// Alterna visibilidade da senha da API Key

function toggleTokenVisibility() {

  const tokenInput = document.getElementById('aiToken');

  const eyeIcon = document.getElementById('tokenEyeIcon');

  if (tokenInput.type === 'password') {

    tokenInput.type = 'text';

    eyeIcon.className = 'ph-bold ph-eye-closed';

  } else {

    tokenInput.type = 'password';

    eyeIcon.className = 'ph-bold ph-eye';

  }

}



// Mostra o formulário de nova busca

function showNewSearchForm() {

  activeSearchId = null;

  closeSSE();

  

  newSearchSection.classList.remove('hidden');

  activeSearchSection.classList.add('hidden');

  settingsSection.classList.add('hidden');

  delugeSection.classList.add('hidden');
  if (monitoredSection) monitoredSection.classList.add('hidden');

  closeDelugeSSE();

  activeSearchQueryTitle.innerText = "Nova Busca Inteligente";

  queryInput.value = '';

  

  renderSearchesList();

}



// --- CONFIGURAÇÕES DO SISTEMA (IA & PREFERÊNCIAS) ---



// Alterna entre abas de configurações

function switchSettingsTab(tabName) {

  if (tabName === 'general') {

    tabGeneralBtn.className = "py-2.5 px-4 border-b-2 border-brand-500 text-brand-600 dark:text-brand-450 font-bold text-xs transition-colors flex items-center gap-1.5";

    tabSourcesBtn.className = "py-2.5 px-4 border-b-2 border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5";

    tabGeneralContent.classList.remove('hidden');

    tabSourcesContent.classList.add('hidden');

  } else {

    tabSourcesBtn.className = "py-2.5 px-4 border-b-2 border-brand-500 text-brand-600 dark:text-brand-450 font-bold text-xs transition-colors flex items-center gap-1.5";

    tabGeneralBtn.className = "py-2.5 px-4 border-b-2 border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5";

    tabGeneralContent.classList.add('hidden');

    tabSourcesContent.classList.remove('hidden');

    fetchSources(); // Recarrega fontes

  }

}



// Exibe a tela de configurações do sistema

function showSettingsSection() {

  activeSearchId = null;

  closeSSE();

  

  newSearchSection.classList.add('hidden');

  activeSearchSection.classList.add('hidden');

  settingsSection.classList.remove('hidden');

  delugeSection.classList.add('hidden');
  if (monitoredSection) monitoredSection.classList.add('hidden');

  closeDelugeSSE();

  activeSearchQueryTitle.innerText = "Configurações Globais";

  

  renderSearchesList();

  fetchSettings();

  switchSettingsTab('general');

}



// Busca as configurações gerais salvas no backend

async function fetchSettings() {

  try {

    const res = await fetch('/api/settings');

    if (!res.ok) throw new Error("Erro ao ler configurações");

    const config = await res.json();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('aiProvider', config.aiProvider || 'openai');
    setVal('aiModel', config.aiModel || 'gemini-3-flash');
    setVal('aiUrl', config.aiUrl || '');
    setVal('aiToken', config.aiToken || '');
    setVal('preferredAudioLanguage', config.preferredAudioLanguage || 'Português (Dublado)');
    setVal('preferredSubtitleLanguage', config.preferredSubtitleLanguage || 'Português (PT-BR)');
    setVal('preferredResolution', config.preferredResolution || '1080p');

    const autoDelCheck = document.getElementById('autoDeleteOldFiles');
    if (autoDelCheck) {
      autoDelCheck.checked = config.autoDeleteOldFiles !== undefined ? (config.autoDeleteOldFiles === 'true' || config.autoDeleteOldFiles === true) : true;
    }

    const minFreeInput = document.getElementById('minFreeSpaceGB');
    if (minFreeInput) {
      minFreeInput.value = config.minFreeSpaceGB !== undefined ? config.minFreeSpaceGB : '4';
    }

    const delugePathEl = document.getElementById('delugeDownloadPath');
    if (delugePathEl) {
      if (config.deluge_download_path) {
        delugePathEl.textContent = config.deluge_download_path;
      } else {
        refreshStoragePath();
      }
    }

    // Atualiza estatísticas de tamanho total e espaço livre do disco
    updateDiskSpaceInfo();

  } catch (err) {

    console.error("Erro ao carregar configurações:", err);

  }

}

// Buscar e atualizar dados de espaço em disco (Total e Livre) no bloco de Armazenamento
async function updateDiskSpaceInfo() {
  const totalEl = document.getElementById('diskTotalSpace');
  const freeEl = document.getElementById('diskFreeSpace');
  if (!totalEl && !freeEl) return;

  try {
    const res = await fetch('/api/storage/disk-info');
    const data = await res.json();
    if (data.success) {
      if (totalEl) totalEl.textContent = data.totalFormatted;
      if (freeEl) freeEl.textContent = data.freeFormatted;
    } else {
      if (totalEl) totalEl.textContent = 'Indisponível';
      if (freeEl) freeEl.textContent = 'Indisponível';
    }
  } catch (err) {
    console.error('Erro ao obter informações do disco:', err);
    if (totalEl) totalEl.textContent = 'Erro ao carregar';
    if (freeEl) freeEl.textContent = 'Erro ao carregar';
  }
}

// Helper genérico para salvar blocos de configurações independentes com feedback visual
async function savePartialSettings(payload, btn, defaultLabelText) {
  if (!btn) return;
  if (btn.disabled) return;

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> Salvando...`;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Erro ao salvar no servidor");

    btn.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Configurações Salvas!`;
    btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
    }, 2000);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    await alert("Erro ao salvar configurações: " + err.message);
  }
}

// Salvar Configurações de IA
async function saveAiSettings(btn) {
  const payload = {
    aiProvider: document.getElementById('aiProvider').value,
    aiModel: document.getElementById('aiModel').value.trim(),
    aiUrl: document.getElementById('aiUrl').value.trim(),
    aiToken: document.getElementById('aiToken').value.trim()
  };
  await savePartialSettings(payload, btn, "IA");
}

// Salvar Preferências de Idioma e Mídia
async function saveLanguageSettings(btn) {
  const payload = {
    preferredAudioLanguage: document.getElementById('preferredAudioLanguage').value.trim(),
    preferredSubtitleLanguage: document.getElementById('preferredSubtitleLanguage').value.trim(),
    preferredResolution: document.getElementById('preferredResolution').value
  };
  await savePartialSettings(payload, btn, "Idiomas");
}

// Salvar Configurações de Espaço em Disco
async function saveStorageSettings(btn) {
  const autoDelCheck = document.getElementById('autoDeleteOldFiles');
  const minFreeInput = document.getElementById('minFreeSpaceGB');

  const payload = {
    autoDeleteOldFiles: autoDelCheck ? (autoDelCheck.checked ? 'true' : 'false') : 'true',
    minFreeSpaceGB: minFreeInput ? minFreeInput.value.trim() : '4'
  };

  await savePartialSettings(payload, btn, "Espaço");
}

// Verificar e Limpar Arquivos Antigos (simulando 10MB)
async function checkAndCleanStorage(btn) {
  if (!btn || btn.disabled) return;

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> Verificando...`;

  try {
    const res = await fetch('/api/storage/check-cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedSizeMB: 10 })
    });
    const data = await res.json();

    if (!data.success) {
      await alert("Aviso de Armazenamento:\n\n" + (data.error || "Não foi possível verificar o espaço."));
    } else {
      await alert(data.message);
    }

    updateDiskSpaceInfo();

    btn.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Verificado!`;
    btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'text-white');

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'text-white');
    }, 3000);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    await alert("Erro ao executar verificação de espaço: " + err.message);
  }
}

// Redescobrir caminho da pasta do Deluge
async function refreshStoragePath() {
  const btn = document.getElementById('btnRefreshStoragePath');
  const pathEl = document.getElementById('delugeDownloadPath');
  const icon = btn ? btn.querySelector('i') : null;
  if (icon) icon.classList.add('animate-spin');
  if (pathEl) pathEl.textContent = 'Redescobrindo caminho do Deluge...';

  try {
    const res = await fetch('/api/storage/discover-path', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.path) {
      if (pathEl) pathEl.textContent = data.path;
    } else {
      if (pathEl) pathEl.textContent = 'Não foi possível encontrar a pasta no Deluge';
    }
  } catch (err) {
    console.error('Erro ao redescobrir caminho do Deluge:', err);
    if (pathEl) pathEl.textContent = 'Erro ao consultar caminho';
  } finally {
    if (icon) icon.classList.remove('animate-spin');
  }
}



// Testar conexão de IA e mostrar logs detalhados
async function testAiConnection() {
  // Limpar e resetar modal para estado inicial
  testAiLogs.innerHTML = '';
  testAiResponseContainer.classList.add('hidden');
  testAiErrorContainer.classList.add('hidden');
  
  // Resetar container de status para neutro/carregando
  testAiStatusContainer.className = "flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20";
  testAiSpinner.classList.remove('hidden');
  testAiSuccessIcon.classList.add('hidden');
  testAiErrorIcon.classList.add('hidden');
  testAiStatusTitle.innerText = "Iniciando teste...";
  testAiStatusSubtitle.innerText = "Preparando envio do prompt para a IA.";
  
  // Exibir o modal
  testAiModal.classList.remove('hidden');

  // Adicionar log inicial local
  const addLocalLog = (msg) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const logLine = document.createElement('div');
    logLine.className = "py-0.5 border-b border-slate-100/5 dark:border-slate-900/50 text-[11px] font-mono leading-relaxed";
    logLine.innerText = `[${time}] ${msg}`;
    testAiLogs.appendChild(logLine);
    testAiLogs.scrollTop = testAiLogs.scrollHeight;
  };

  addLocalLog("Lendo parâmetros do formulário...");

  const config = {
    aiProvider: document.getElementById('aiProvider').value,
    aiModel: document.getElementById('aiModel').value.trim(),
    aiUrl: document.getElementById('aiUrl').value.trim(),
    aiToken: document.getElementById('aiToken').value.trim()
  };

  if (!config.aiModel) {
    addLocalLog("[ALERTA] Modelo não especificado! Utilizando valor padrão.");
  }
  if (!config.aiUrl) {
    addLocalLog("[ERRO] URL Base vazia.");
    testAiSpinner.classList.add('hidden');
    testAiErrorIcon.classList.remove('hidden');
    testAiStatusContainer.className = "flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/10";
    testAiStatusTitle.innerText = "Parâmetros inválidos";
    testAiStatusSubtitle.innerText = "A URL Base da API é obrigatória.";
    return;
  }

  addLocalLog("Enviando requisição de teste para o backend...");
  
  try {
    const res = await fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const result = await res.json();
    
    // Função para animar a exibição dos logs linha por linha
    const printLogsSequentially = async (logsArray) => {
      for (const logLineText of logsArray) {
        // Extrai a mensagem de log limpa se começar com timestamp, ou apenas imprime
        const cleanText = logLineText.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
        addLocalLog(cleanText);
        // Pequeno atraso para dar um efeito visual incrível!
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    };

    if (result.logs && Array.isArray(result.logs)) {
      await printLogsSequentially(result.logs);
    }
    
    if (result.success) {
      addLocalLog("[SUCESSO] Teste de conexão finalizado com êxito!");
      
      // Atualizar status para sucesso
      testAiSpinner.classList.add('hidden');
      testAiSuccessIcon.classList.remove('hidden');
      testAiStatusContainer.className = "flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10";
      testAiStatusTitle.innerText = "Conexão de IA ativa!";
      testAiStatusSubtitle.innerText = "O modelo respondeu corretamente.";
      
      // Mostrar resposta
      testAiResponseText.innerText = result.responseText || "ok (ou nenhuma resposta de texto extraída)";
      testAiResponseContainer.classList.remove('hidden');
    } else {
      addLocalLog("[FALHA] Teste de conexão falhou.");
      
      // Atualizar status para erro
      testAiSpinner.classList.add('hidden');
      testAiErrorIcon.classList.remove('hidden');
      testAiStatusContainer.className = "flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/10";
      testAiStatusTitle.innerText = "Erro ao conectar com a IA";
      testAiStatusSubtitle.innerText = "O provedor retornou uma falha.";
      
      // Mostrar detalhes do erro
      testAiErrorText.innerText = result.error || "Erro desconhecido";
      testAiErrorContainer.classList.remove('hidden');
    }
  } catch (err) {
    addLocalLog(`[ERRO DE CONEXÃO] Falha ao comunicar com o servidor de busca: ${err.message}`);
    testAiSpinner.classList.add('hidden');
    testAiErrorIcon.classList.remove('hidden');
    testAiStatusContainer.className = "flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/10";
    testAiStatusTitle.innerText = "Erro de Comunicação";
    testAiStatusSubtitle.innerText = "Não foi possível enviar a requisição ao servidor local.";
    
    testAiErrorText.innerText = err.message || String(err);
    testAiErrorContainer.classList.remove('hidden');
  }
}



// --- CRUD DE FONTES DE BUSCA ---



// Carrega a lista de fontes cadastradas

async function fetchSources() {

  try {

    const res = await fetch('/api/sources');

    if (!res.ok) throw new Error("Erro ao carregar fontes");

    searchSources = await res.json();

    renderSourcesTable();

  } catch (err) {

    console.error("Erro ao ler fontes:", err);

  }

}

function renderSourcesTable() {

  const sourcesCountBadge = document.getElementById('sourcesCountBadge');
  if (sourcesCountBadge) {
    const activeCount = searchSources.filter(s => s.isActive).length;
    sourcesCountBadge.textContent = `${activeCount}/${searchSources.length} ativos`;
    sourcesCountBadge.classList.remove('hidden');
  }

  if (searchSources.length === 0) {

    sourcesTableBody.innerHTML = `

      <tr>

        <td colspan="5" class="py-12 px-6 text-center text-slate-400 dark:text-slate-500">

          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">

            <i class="ph-bold ph-globe text-2xl opacity-60"></i>

          </div>

          <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">Nenhum site cadastrado</p>

          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">Cadastre ou importe fontes de busca para permitir que a IA encontre torrents.</p>

          <button onclick="openSourceModal()" class="mt-4 py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shadow-sm">

            <i class="ph-bold ph-plus-circle text-sm"></i> Cadastrar Primeira Fonte

          </button>

        </td>

      </tr>`;

    return;

  }



  sourcesTableBody.innerHTML = searchSources.map(source => {

    // Badges de tipos de conteúdos

    const typeBadges = (source.contentTypes || []).map(t => {

      let label = t;

      let color = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';

      if (t === 'series') { label = 'Séries'; color = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'; }

      if (t === 'movies') { label = 'Filmes'; color = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'; }

      if (t === 'book') { label = 'Livros'; color = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'; }

      if (t === 'music') { label = 'Músicas'; color = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'; }

      if (t === 'other') { label = 'Outros'; color = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'; }

      

      return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${color} inline-flex items-center gap-1">${label}</span>`;

    }).join(' ');



    const statusBadge = source.isActive
      ? `<span class="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>Ativo</span>`
      : `<span class="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Inativo</span>`;

    const cleanUrl = (source.url || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

    return `

      <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-xs group">

        <td class="py-3.5 px-6 align-middle">

          <div class="flex items-center gap-3">

            <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">

              ${(source.name || 'S').charAt(0).toUpperCase()}

            </div>

            <div class="min-w-0">

              <span class="font-bold text-slate-800 dark:text-slate-200 text-xs block truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">

                ${source.name}

              </span>

              <p class="text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-xs" title="${source.description || ''}">

                ${source.description || 'Sem descrição cadastrada.'}

              </p>

            </div>

          </div>

        </td>

        <td class="py-3.5 px-6 align-middle font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title="${source.searchUrlPattern || source.url}">

          <a href="${source.url}" target="_blank" class="hover:text-brand-600 dark:hover:text-brand-400 underline underline-offset-2 transition-colors flex items-center gap-1">

            <span class="truncate">${cleanUrl || source.url}</span>

            <i class="ph-bold ph-arrow-square-out text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>

          </a>

        </td>

        <td class="py-3.5 px-6 align-middle">

          <div class="flex flex-wrap gap-1">${typeBadges || '<span class="text-slate-400 dark:text-slate-500 text-[10px]">Nenhum</span>'}</div>

        </td>

        <td class="py-3.5 px-6 align-middle">${statusBadge}</td>

        <td class="py-3.5 px-6 align-middle text-right">

          <div class="flex items-center justify-end gap-1.5">

            <button onclick="analyzeSource(${source.id})" class="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-xl transition-all shadow-xs" title="Otimizar Busca com IA">

              <i class="ph-bold ph-sparkle text-sm"></i>

            </button>

            <button onclick="toggleSourceActive(${source.id})" class="p-1.5 ${source.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'} rounded-xl transition-all shadow-xs" title="${source.isActive ? 'Desativar Site' : 'Ativar Site'}">

              <i class="ph-bold ${source.isActive ? 'ph-toggle-right' : 'ph-toggle-left'} text-sm"></i>

            </button>

            <button onclick="editSource(${source.id})" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 rounded-xl transition-all shadow-xs" title="Editar">

              <i class="ph-bold ph-pencil-simple text-sm"></i>

            </button>

            <button onclick="deleteSource(${source.id})" class="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl transition-all shadow-xs" title="Excluir">

              <i class="ph-bold ph-trash text-sm"></i>

            </button>

          </div>

        </td>

      </tr>`;

  }).join('');

}



// Abre o modal de fonte (para criar ou editar)

function openSourceModal(source = null) {

  sourceForm.reset();

  

  if (source) {

    modalTitle.innerHTML = `<i class="ph-bold ph-pencil-simple"></i> Editar Fonte: ${source.name}`;

    sourceIdInput.value = source.id;

    sourceNameInput.value = source.name;

    sourceUrlInput.value = source.url;

    sourcePatternInput.value = source.searchUrlPattern;

    sourceDescriptionInput.value = source.description || '';

    sourceActiveInput.checked = source.isActive;

    

    // Marca checkboxes

    const types = source.contentTypes || [];

    const checkboxes = sourceForm.querySelectorAll('input[name="contentTypes"]');

    checkboxes.forEach(cb => {

      cb.checked = types.includes(cb.value);

    });

  } else {

    modalTitle.innerHTML = `<i class="ph-bold ph-plus-circle"></i> Cadastrar Nova Fonte`;

    sourceIdInput.value = '';

    sourceActiveInput.checked = true;

    

    const checkboxes = sourceForm.querySelectorAll('input[name="contentTypes"]');

    checkboxes.forEach(cb => cb.checked = false);

  }

  

  sourceModal.classList.remove('hidden');

}



// Fecha o modal de fonte

function closeSourceModal() {

  sourceModal.classList.add('hidden');

}



// Callback do clique em Editar Fonte

function editSource(id) {

  const source = searchSources.find(s => s.id === id);

  if (source) openSourceModal(source);

}



// Trata o envio do formulário de Fonte (Criação/Edição)

async function handleSourceSubmit(e) {
  e.preventDefault();
  
  const submitBtn = sourceForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;
  }
  
  const id = sourceIdInput.value;
  const checkboxes = sourceForm.querySelectorAll('input[name="contentTypes"]:checked');
  const contentTypes = Array.from(checkboxes).map(cb => cb.value);
  
  const sourceData = {
    name: sourceNameInput.value.trim(),
    url: sourceUrlInput.value.trim(),
    searchUrlPattern: sourcePatternInput.value.trim(),
    description: sourceDescriptionInput.value.trim(),
    contentTypes: contentTypes,
    isActive: sourceActiveInput.checked
  };

  try {
    let url = '/api/sources';
    let method = 'POST';
    
    if (id) {
      url = `/api/sources/${id}`;
      method = 'PUT';
    }
    
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sourceData)
    });
    
    if (!res.ok) throw new Error("Erro ao gravar fonte de busca");
    
    closeSourceModal();
    fetchSources(); // Recarrega a listagem
  } catch (err) {
    await alert("Falha ao salvar fonte: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset.originalHtml || submitBtn.innerHTML;
    }
  }
}



// Ativa ou desativa uma fonte de busca diretamente
async function toggleSourceActive(id) {
  const source = searchSources.find(s => s.id === id);
  if (!source) return;

  const newStatus = !source.isActive;

  try {
    const res = await fetch(`/api/sources/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isActive: newStatus
      })
    });

    if (!res.ok) throw new Error("Erro ao atualizar status da fonte");

    await fetchSources();
    showDelugeToast(`Site "${source.name}" ${newStatus ? 'ativado' : 'desativado'} com sucesso!`, "success");
  } catch (err) {
    await alert("Erro: " + err.message);
  }
}

// Exclui uma fonte de busca

async function deleteSource(id) {

  const source = searchSources.find(s => s.id === id);

  if (!source) return;

  

  if (!await confirm(`Excluir a fonte de busca "${source.name}"? Isso impedirá o agente de IA de pesquisar nela.`)) return;

  

  try {

    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });

    if (!res.ok) throw new Error("Erro ao excluir fonte");

    

    fetchSources();

  } catch (err) {

    await alert("Erro: " + err.message);

  }

}



// Exporta as fontes de busca cadastradas para um arquivo JSON

async function exportSources() {

  if (searchSources.length === 0) {

    await alert("Nenhuma fonte de busca cadastrada para exportar.");

    return;

  }

  

  // Limpa IDs e campos internos do Sequelize para gerar um arquivo limpo

  const cleanSources = searchSources.map(s => ({

    name: s.name,

    url: s.url,

    searchUrlPattern: s.searchUrlPattern,

    description: s.description,

    contentTypes: s.contentTypes,

    isActive: s.isActive

  }));

  

  try {

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanSources, null, 2));

    const downloadAnchor = document.createElement('a');

    downloadAnchor.setAttribute("href", dataStr);

    downloadAnchor.setAttribute("download", "busca_torrent_fontes.json");

    document.body.appendChild(downloadAnchor);

    downloadAnchor.click();

    downloadAnchor.remove();

  } catch (err) {

    await alert("Erro ao exportar fontes de busca: " + err.message);

  }

}



// Importa fontes de busca a partir de um arquivo JSON

async function importSources() {

  const fileInput = document.createElement('input');

  fileInput.type = 'file';

  fileInput.accept = '.json';

  fileInput.onchange = async (e) => {

    const file = e.target.files[0];

    if (!file) return;

    

    const reader = new FileReader();

    reader.onload = async (evt) => {

      try {

        const imported = JSON.parse(evt.target.result);

        const list = Array.isArray(imported) ? imported : [imported];

        

        // Validação mínima no cliente

        for (const s of list) {

          if (!s.name || !s.url || !s.searchUrlPattern) {

            throw new Error("Formato inválido. Cada fonte deve conter Nome, URL e Padrão de URL de Busca.");

          }

        }

        

        const res = await fetch('/api/sources/import', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify(list)

        });

        

        if (!res.ok) {

          const errData = await res.json();

          throw new Error(errData.error || "Erro ao importar fontes no servidor");

        }

        

        const result = await res.json();

        await alert(result.message || "Fontes de busca importadas com sucesso.");

        fetchSources(); // Recarrega do banco

      } catch (err) {

        await alert("Erro na importação: " + err.message);

      }

    };

    reader.readAsText(file);

  };

  fileInput.click();

}



// --- BUSCAS E EXECUÇÃO ---

function connectGlobalSSE() {
  if (globalEventSource) {
    try { globalEventSource.close(); } catch(e) {}
  }
  
  globalEventSource = new EventSource('/api/sse/global');
  
  globalEventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      const { searchId, type, data } = payload;
      const idNum = Number(searchId);
      
      switch (type) {
        case 'result':
          const search = searches.find(s => s.id === idNum);
          if (search) {
            const newCount = (search.resultsCount || 0) + 1;
            updateSidebarResultCount(idNum, newCount);
          }
          if (activeSearchId === idNum) {
            if (!activeSearchData.results.some(r => r.id === data.id)) {
              activeSearchData.results.push(data);
              appendResultCard(data);
              resultsCountBadge.innerText = activeSearchData.results.length;
            }
          }
          localStorage.setItem('cached_searches', JSON.stringify(searches));
          break;
          
        case 'status_change':
          updateSidebarStatus(idNum, data.status);
          if (activeSearchId === idNum) {
            updateActiveSearchStatusUI(data.status);
          }
          localStorage.setItem('cached_searches', JSON.stringify(searches));
          break;
          
        case 'meta_change':
          updateSidebarMeta(idNum, data.type, data.episodesCount);
          if (activeSearchId === idNum) {
            updateActiveSearchMetaUI(data.type, data.episodesCount);
          }
          localStorage.setItem('cached_searches', JSON.stringify(searches));
          break;
      }
    } catch (err) {
      console.warn("Erro ao processar mensagem SSE global:", err);
    }
  };

  globalEventSource.onerror = () => {
    console.warn("SSE global desconectado. Tentando reconectar em 5 segundos...");
    try { globalEventSource.close(); } catch(e) {}
    setTimeout(connectGlobalSSE, 5000);
  };
}

async function fetchSearches() {
  // Tenta carregar cache instantaneamente do localStorage para melhor UX (SWR no cliente)
  const cached = localStorage.getItem('cached_searches');
  if (cached) {
    try {
      searches = JSON.parse(cached);
      updateStats();
      renderSearchesList();
    } catch (e) {
      console.warn("Erro ao decodificar buscas cacheadas:", e);
    }
  }

  try {
    const res = await fetch('/api/searches');
    if (!res.ok) throw new Error("Erro ao carregar histórico");
    searches = await res.json();
    
    // Atualiza cache local
    localStorage.setItem('cached_searches', JSON.stringify(searches));
    
    updateStats();
    renderSearchesList();
  } catch (err) {
    console.error("Falha ao carregar buscas:", err);
  }
}



// Seleciona e exibe uma busca do histórico

async function selectSearch(id) {

  activeSearchId = id;

  closeSSE();

  

  try {

    const res = await fetch(`/api/searches/${id}`);

    if (!res.ok) throw new Error("Erro ao carregar detalhes da busca");

    const searchData = await res.json();

    

    activeSearchData.results = searchData.results || [];

    activeSearchData.logs = searchData.logs || [];

    

    activeSearchQueryTitle.innerText = `Busca: "${searchData.query}"`;

    activeSearchTitle.innerText = searchData.query;

    activeSearchDate.innerText = new Date(searchData.createdAt).toLocaleString('pt-BR');

    

    updateActiveSearchStatusUI(searchData.status);

    updateActiveSearchMetaUI(searchData.type, searchData.episodesCount);

    

    renderLogs();

    renderResults();

    

    newSearchSection.classList.add('hidden');

    activeSearchSection.classList.remove('hidden');

    settingsSection.classList.add('hidden'); // Oculta configurações

    delugeSection.classList.add('hidden');

    closeDelugeSSE();

    

    renderSearchesList();

    

    if (searchData.status === 'searching' || searchData.status === 'pending') {

      openSSE(id);

    }

  } catch (err) {
    await alert("Falha ao selecionar busca: " + err.message);
  }
}

async function handleSearchClick(id) {
  await selectSearch(id);
  setTimeout(() => {
    const terminalLogs = document.getElementById('terminalLogs');
    if (terminalLogs) {
      terminalLogs.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

async function handleSearchSubmit(e) {
  e.preventDefault();

  const query = queryInput.value.trim();
  if (!query) return;

  const submitBtn = searchForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Iniciando...`;
  }

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!res.ok) throw new Error("Falha ao criar busca");
    const newSearch = await res.json();
    
    searches.unshift({ ...newSearch, resultsCount: 0 });
    updateStats();
    
    // Salva no localStorage para SWR
    localStorage.setItem('cached_searches', JSON.stringify(searches));
    
    selectSearch(newSearch.id);
    queryInput.value = ''; // limpa o input
  } catch (err) {
    await alert("Erro: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset.originalHtml || submitBtn.innerHTML;
    }
  }
}

// Para a busca ativa
async function stopActiveSearch() {
  if (!activeSearchId) return;

  const originalHtml = stopSearchBtn ? stopSearchBtn.innerHTML : null;
  if (stopSearchBtn) {
    stopSearchBtn.disabled = true;
    stopSearchBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Parando...`;
  }

  try {
    const res = await fetch(`/api/searches/${activeSearchId}/stop`, { method: 'POST' });
    if (!res.ok) throw new Error("Falha ao parar busca");
    
    updateActiveSearchStatusUI('stopped');
  } catch (err) {
    await alert("Erro: " + err.message);
  } finally {
    if (stopSearchBtn) {
      stopSearchBtn.disabled = false;
      stopSearchBtn.innerHTML = originalHtml;
    }
  }
}

// Reinicia ou retoma a busca
async function restartActiveSearch(resume) {
  if (!activeSearchId) return;

  const confirmMsg = resume 
    ? "Deseja retomar a busca de onde parou? (O agente continuará avaliando apenas novos torrents)"
    : "Tem certeza que deseja reiniciar do zero? Todos os resultados e logs desta busca serão apagados.";
    
  if (!await confirm(confirmMsg)) return;

  const btn = resume ? resumeSearchBtn : restartSearchBtn;
  const originalHtml = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> ${resume ? 'Retomando...' : 'Reiniciando...'}`;
  }

  try {
    const res = await fetch(`/api/searches/${activeSearchId}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume })
    });
    
    if (!res.ok) throw new Error("Falha ao comandar reinicialização");
    const updatedSearch = await res.json();
    
    if (!resume) {
      activeSearchData.results = [];
      activeSearchData.logs = [];
      renderLogs();
      renderResults();
    }
    
    updateActiveSearchStatusUI('pending');
    updateActiveSearchMetaUI(updatedSearch.type, updatedSearch.episodesCount);
    
    openSSE(activeSearchId);
  } catch (err) {
    await alert("Erro: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Exclui busca
async function deleteSearch(id, event) {
  event.stopPropagation();

  if (!await confirm("Excluir esta busca e todos os seus resultados permanentemente?")) return;

  try {
    const res = await fetch(`/api/searches/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Erro ao excluir busca");
    
    if (activeSearchId === id) {
      showNewSearchForm();
    }
    
    searches = searches.filter(s => s.id !== id);
    updateStats();
    renderSearchesList();
  } catch (err) {
    await alert("Falha ao excluir busca: " + err.message);
  }
}



// --- CONEXÃO SSE (Server-Sent Events) ---



function openSSE(searchId) {

  closeSSE();

  

  eventSource = new EventSource(`/api/searches/${searchId}/stream`);

  

  eventSource.onmessage = (event) => {

    try {

      const payload = JSON.parse(event.data);

      const { type, data } = payload;

      

      switch (type) {

        case 'log':

          activeSearchData.logs.push(data);

          appendLogLine(data);

          break;

        case 'result':

          if (!activeSearchData.results.some(r => r.id === data.id)) {

            activeSearchData.results.push(data);

            appendResultCard(data);

            

            resultsCountBadge.innerText = activeSearchData.results.length;

            updateSidebarResultCount(searchId, activeSearchData.results.length);

          }

          break;

        case 'status_change':

          updateActiveSearchStatusUI(data.status);

          updateSidebarStatus(searchId, data.status);

          if (['completed', 'stopped', 'failed'].includes(data.status)) {

            closeSSE();

          }

          break;

        case 'meta_change':

          updateActiveSearchMetaUI(data.type, data.episodesCount);

          updateSidebarMeta(searchId, data.type, data.episodesCount);

          break;

        case 'restart':

          if (!data.resume) {

            activeSearchData.results = [];

            activeSearchData.logs = [];

            terminalLogs.innerHTML = '';

            torrentResultsGrid.innerHTML = '';

            resultsCountBadge.innerText = '0';

            updateSidebarResultCount(searchId, 0);

          }

          break;

      }

    } catch (err) {

      console.error("Erro ao processar dados SSE:", err);

    }

  };



  eventSource.onerror = (err) => {

    console.error("Erro na conexão SSE:", err);

    closeSSE();

  };

}



function closeSSE() {

  if (eventSource) {

    eventSource.close();

    eventSource = null;

  }

}

function setupDelugeSSE() {
  closeDelugeSSE();
  
  delugeTorrentsContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent mb-3"></div>
      <p class="text-xs">Conectando ao painel do Deluge...</p>
    </div>`;
    
  delugeEventSource = new EventSource('/api/deluge/stream');
  
  delugeEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      delugeOnline = data.disponivel;
      
      if (delugeOnline) {
        delugeStatusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20";
        delugeStatusDot.title = `Deluge Online (Porta: ${data.port})`;
        
        delugePanelStatusBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
        delugePanelStatusBadge.innerText = "Online";
        delugePanelOfflineAlert.classList.add('hidden');
        
        delugeTorrentsCache = data.torrents || {};
        renderDelugeTorrents(delugeTorrentsCache);
      } else {
        delugeStatusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
        delugeStatusDot.title = "Deluge Offline ou Indisponível";
        
        delugePanelStatusBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/10 text-red-600 border border-red-500/20";
        delugePanelStatusBadge.innerText = "Offline";
        delugePanelOfflineAlert.classList.remove('hidden');
        
        delugeTorrentsContainer.innerHTML = `
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500 shadow-sm">
            <i class="ph-bold ph-warning text-3xl mb-2 text-amber-500 opacity-60"></i>
            <h4 class="font-bold text-slate-700 dark:text-slate-350">Deluge não disponível</h4>
            <p class="text-xs max-w-sm mx-auto mt-1">Não foi possível obter a listagem de torrents pois o serviço Deluge está offline.</p>
          </div>`;
          
        delugeStatTotal.innerText = '0';
        delugeStatDownloading.innerText = '0';
        delugeStatDlSpeed.innerText = '0 KB/s';
        delugeStatUlSpeed.innerText = '0 KB/s';
      }
    } catch (err) {
      console.error("Erro ao processar dados do SSE do Deluge:", err);
    }
  };
  
  delugeEventSource.onerror = (err) => {
    console.error("Erro na conexão SSE do Deluge:", err);
    closeDelugeSSE();
    
    // Tenta reconectar após 5 segundos se ainda estiver na aba do Deluge
    if (!delugeSection.classList.contains('hidden')) {
      setTimeout(setupDelugeSSE, 5000);
    }
  };
}

function closeDelugeSSE() {
  if (delugeEventSource) {
    delugeEventSource.close();
    delugeEventSource = null;
  }
}



// --- RENDERIZADORES DO SIDEBAR E TELA PRINCIPAL ---



function updateStats() {

  statTotal.innerText = searches.length;

  statCompleted.innerText = searches.filter(s => s.status === 'completed').length;

  statActive.innerText = searches.filter(s => s.status === 'searching' || s.status === 'pending').length;

}



function renderSearchesList() {

  if (searches.length === 0) {

    searchesList.innerHTML = `

      <div class="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">

        <i class="ph-bold ph-folder-open text-2xl mb-1 block opacity-50"></i>

        Nenhuma busca registrada

      </div>`;

    return;

  }



  searchesList.innerHTML = searches.map(search => {

    const isActive = search.id === activeSearchId;

    

    let statusDotClass = '';

    switch (search.status) {

      case 'searching':

        statusDotClass = 'bg-blue-500 animate-pulse';

        break;

      case 'pending':

        statusDotClass = 'bg-amber-500 animate-pulse';

        break;

      case 'completed':

        statusDotClass = 'bg-emerald-500';

        break;

      case 'stopped':

        statusDotClass = 'bg-slate-400 dark:bg-slate-500';

        break;

      case 'failed':

        statusDotClass = 'bg-red-500';

        break;

    }



    const typeIcon = search.type === 'movie' 

      ? '<i class="ph-bold ph-film text-xs"></i> Filme' 

      : search.type === 'series' 

        ? `<i class="ph-bold ph-television text-xs"></i> Série (${search.episodesCount} eps)` 

        : search.type === 'book'

          ? '<i class="ph-bold ph-book text-xs"></i> Livro'

          : search.type === 'music'

            ? '<i class="ph-bold ph-music-notes text-xs"></i> Música'

            : '<i class="ph-bold ph-question text-xs"></i>';



    return `

      <div onclick="handleSearchClick(${search.id})" class="group cursor-pointer p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${

        isActive 

          ? 'bg-brand-500/5 dark:bg-brand-500/10 border-brand-500/30 text-brand-700 dark:text-brand-300' 

          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'

      }">

        <div class="space-y-1.5 flex-1 min-w-0">

          <div class="flex items-center gap-2">

            <span class="w-2 h-2 rounded-full ${statusDotClass} flex-shrink-0"></span>

            <p class="font-bold text-xs truncate" title="${search.query}">${search.query}</p>

          </div>

          <div class="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium">

            <span>${new Date(search.createdAt).toLocaleDateString('pt-BR')}</span>

            <span>•</span>

            <span class="flex items-center gap-1">${typeIcon}</span>

          </div>

        </div>



        <div class="flex items-center gap-2 flex-shrink-0">

          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 font-medium">

            <span class="count-val-${search.id}">${search.resultsCount || 0}</span> magnets

          </span>

          <button onclick="deleteSearch(${search.id}, event)" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Excluir busca">

            <i class="ph-bold ph-trash text-sm"></i>

          </button>

        </div>

      </div>`;

  }).join('');

}



function updateSidebarResultCount(searchId, count) {

  const el = document.querySelector(`.count-val-${searchId}`);

  if (el) el.innerText = count;

  const search = searches.find(s => s.id === searchId);

  if (search) search.resultsCount = count;

}



function updateSidebarStatus(searchId, status) {

  const search = searches.find(s => s.id === searchId);

  if (search) {

    search.status = status;

    updateStats();

    renderSearchesList();

  }

}



function updateSidebarMeta(searchId, type, count) {

  const search = searches.find(s => s.id === searchId);

  if (search) {

    search.type = type;

    search.episodesCount = count;

    renderSearchesList();

  }

}



function updateActiveSearchStatusUI(status) {

  let badgeText = '';

  let badgeClass = '';

  

  stopSearchBtn.classList.add('hidden');

  resumeSearchBtn.classList.add('hidden');

  restartSearchBtn.classList.add('hidden');



  switch (status) {

    case 'searching':

      badgeText = 'Rastreando com IA';

      badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

      stopSearchBtn.classList.remove('hidden');

      break;

    case 'pending':

      badgeText = 'Fila de IA';

      badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse';

      stopSearchBtn.classList.remove('hidden');

      break;

    case 'completed':

      badgeText = 'Concluído';

      badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

      restartSearchBtn.classList.remove('hidden');

      break;

    case 'stopped':

      badgeText = 'Busca Interrompida';

      badgeClass = 'bg-slate-500/10 text-slate-500 border-slate-500/20';

      resumeSearchBtn.classList.remove('hidden');

      restartSearchBtn.classList.remove('hidden');

      break;

    case 'failed':

      badgeText = 'Falha no Agente';

      badgeClass = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';

      resumeSearchBtn.classList.remove('hidden');

      restartSearchBtn.classList.remove('hidden');

      break;

  }



  activeSearchStatusBadge.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 ${status === 'searching' || status === 'pending' ? 'animate-ping' : ''}"></span> ${badgeText}`;

  activeSearchStatusBadge.className = `px-2.5 py-1 text-[11px] font-bold rounded-full border ${badgeClass}`;

}



function updateActiveSearchMetaUI(type, episodesCount) {

  let metaText = '';

  if (type === 'movie') {

    metaText = '🎬 Filme Único';

  } else if (type === 'series') {

    const epCountStr = episodesCount === 'unknown' ? 'Não estimado' : `${episodesCount} episódios`;

    metaText = `📺 Série / Anime (${epCountStr})`;

  } else if (type === 'book') {

    metaText = '📚 Livro / Mangá';

  } else if (type === 'music') {

    metaText = '🎵 Música / Álbum';

  } else {

    metaText = '🔍 Tipo: Investigando...';

  }

  activeSearchMetaBadge.innerText = metaText;

}



function renderLogs() {

  terminalLogs.innerHTML = '';

  activeSearchData.logs.forEach(log => appendLogLine(log));

}



function appendLogLine(log) {

  const line = document.createElement('div');

  let colorClass = 'text-slate-400';

  let prefix = '[INFO]';

  

  if (log.level === 'success') {

    colorClass = 'text-emerald-400 font-semibold';

    prefix = '[SUCESSO]';

  } else if (log.level === 'warn') {

    colorClass = 'text-amber-400';

    prefix = '[ALERTA]';

  } else if (log.level === 'error') {

    colorClass = 'text-red-400 font-bold';

    prefix = '[ERRO]';

  }

  

  const timestamp = new Date(log.createdAt).toLocaleTimeString('pt-BR');

  line.className = `${colorClass} py-0.5`;

  line.innerHTML = `<span class="text-slate-600 font-medium">[${timestamp}]</span> <span class="opacity-80">${prefix}</span> ${log.message}`;

  

  terminalLogs.appendChild(line);

  terminalLogs.scrollTop = terminalLogs.scrollHeight;

}



function renderResults() {

  torrentResultsGrid.innerHTML = '';

  resultsCountBadge.innerText = activeSearchData.results.length;



  if (activeSearchData.results.length === 0) {

    torrentResultsGrid.innerHTML = `

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500">

        <i class="ph-bold ph-sparkle text-3xl mb-2 text-brand-500 opacity-60"></i>

        <h4 class="font-bold text-slate-700 dark:text-slate-300">Aguardando resultados correspondentes...</h4>

        <p class="text-xs max-w-sm mx-auto mt-1">O agente de IA está raspando a internet e analisará os arquivos em breve.</p>

      </div>`;

    copyAllMagnetsBtn.disabled = true;

    copyAllMagnetsBtn.className = "py-2.5 px-4 bg-slate-350 dark:bg-slate-800 text-slate-400 rounded-xl text-xs cursor-not-allowed flex items-center gap-2";

    downloadAllDelugeBtn.classList.add('hidden');

    return;

  }



  copyAllMagnetsBtn.disabled = false;

  if (delugeOnline) {

    downloadAllDelugeBtn.classList.remove('hidden');

  } else {

    downloadAllDelugeBtn.classList.add('hidden');

  }

  copyAllMagnetsBtn.className = "py-2.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-brand-500/10 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer";

  

  activeSearchData.results.forEach(result => appendResultCard(result));

}



function appendResultCard(result) {

  const placeholder = torrentResultsGrid.querySelector('.text-center');

  if (placeholder) {

    torrentResultsGrid.innerHTML = '';

  }



  const card = document.createElement('div');

  card.className = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all animate-fadeIn";

  

  let langBadges = '';

  if (result.hasPortugueseAudio) {

    langBadges += `<span class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><i class="ph-fill ph-microphone"></i> Áudio PT-BR</span>`;

  }

  if (result.hasPortugueseSubtitles) {

    langBadges += `<span class="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><i class="ph-fill ph-closed-captioning"></i> Legenda PT-BR</span>`;

  }

  if (!result.hasPortugueseAudio && !result.hasPortugueseSubtitles) {

    langBadges += `<span class="bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><i class="ph-fill ph-globe"></i> Outro Idioma</span>`;

  }



  const resBadge = result.resolution === '1085p' || result.resolution === '1080p'

    ? `<span class="bg-brand-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">1080p 🔥</span>`

    : `<span class="bg-slate-200 dark:bg-slate-850 text-slate-650 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md">${result.resolution}</span>`;



  let typeText = 'Arquivo Único';

  if (result.episodes === 'movie') {

    typeText = 'Filme';

  } else if (result.episodes === 'unknown') {

    typeText = 'Qtd. Desconhecida';

  } else {

    typeText = `${result.episodes} Episódio(s)`;

  }



  card.innerHTML = `

    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">

      <div class="space-y-1.5">

        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug break-all">${result.title}</h4>

        <div class="flex flex-wrap items-center gap-2">

          ${resBadge}

          <span class="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">

            <i class="ph-bold ph-folders"></i> ${typeText}

          </span>

          <span class="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-850">

            Fonte: ${result.sourceName}

          </span>

          <span class="text-xs text-slate-400 dark:text-slate-500 font-medium">Tamanho: ${result.size || 'N/A'}</span>

        </div>

      </div>

      <div class="flex flex-row sm:flex-col items-end gap-1.5 flex-shrink-0">

        <span class="text-emerald-500 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">

          <i class="ph-fill ph-arrow-up-right"></i> ${result.seeders} seeds

        </span>

        <span class="text-slate-400 text-[10px] font-medium">

          ${result.leechers} leechers

        </span>

      </div>

    </div>



    <!-- Avaliação da IA -->

    <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850 flex gap-2.5 items-start">

      <div class="text-brand-500 text-base mt-0.5 flex-shrink-0"><i class="ph-bold ph-brain"></i></div>

      <div class="space-y-1">

        <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avaliação da Inteligência Artificial</h5>

        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${result.explanation}</p>

      </div>

    </div>



    <!-- Rodapé do Card -->

    <div class="flex items-center justify-between gap-4 mt-1">

      <div class="flex items-center gap-2">

        ${langBadges}

      </div>



      <div class="flex items-center gap-2">

        ${result.pageUrl ? `

        <a href="${result.pageUrl}" target="_blank" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors">

          <i class="ph-bold ph-arrow-square-out text-sm"></i> Ver Site

        </a>` : ''}

${delugeOnline ? `

        <button onclick="sendToDeluge('${result.magnetLink}', this, '${escapeHtml(result.size || '')}')" class="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors mr-1">

          <i class="ph-bold ph-download-simple text-sm"></i> Enviar p/ Deluge

        </button>

        ` : ''}

        <button onclick="copyToClipboard('${result.magnetLink}', this)" class="py-2 px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">

          <i class="ph-bold ph-copy text-sm"></i> Copiar Magnet

        </button>

      </div>

    </div>

  `;

  

  torrentResultsGrid.appendChild(card);

}



// --- UTILITÁRIOS ---



function copyToClipboard(text, buttonEl) {

  navigator.clipboard.writeText(text).then(() => {

    const origHtml = buttonEl.innerHTML;

    buttonEl.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Copiado!`;

    buttonEl.className = buttonEl.className.replace('bg-brand-500', 'bg-emerald-500').replace('hover:bg-brand-600', 'hover:bg-emerald-600');

    

    setTimeout(() => {

      buttonEl.innerHTML = origHtml;

      buttonEl.className = buttonEl.className.replace('bg-emerald-500', 'bg-brand-500').replace('hover:bg-emerald-600', 'hover:bg-brand-600');

    }, 2000);

  }).catch(async err => {

    await alert("Erro ao copiar para clipboard: " + err.message);

  });

}



async function copyAllMagnetLinks() {

  if (activeSearchData.results.length === 0) return;

  const allMagnets = activeSearchData.results.map(r => r.magnetLink).join('\n');

  

  navigator.clipboard.writeText(allMagnets).then(() => {

    const origHtml = copyAllMagnetsBtn.innerHTML;

    copyAllMagnetsBtn.innerHTML = `<i class="ph-bold ph-check"></i> Todos Copiados!`;

    copyAllMagnetsBtn.className = copyAllMagnetsBtn.className.replace('from-brand-600', 'from-emerald-600').replace('to-indigo-600', 'to-emerald-500');

    

    setTimeout(() => {

      copyAllMagnetsBtn.innerHTML = origHtml;

      copyAllMagnetsBtn.className = copyAllMagnetsBtn.className.replace('from-emerald-600', 'from-brand-600').replace('to-emerald-500', 'to-indigo-600');

    }, 2000);

  }).catch(async err => {

    await alert("Erro ao copiar magnets: " + err.message);

  });

}





// --- FUNÇÕES DE INTEGRAÇÃO DO DELUGE ---



function showDelugeSection() {
  activeSearchId = null;
  closeSSE();
  closeDelugeSSE();
  
  newSearchSection.classList.add('hidden');
  activeSearchSection.classList.add('hidden');
  settingsSection.classList.add('hidden');
  if (monitoredSection) monitoredSection.classList.add('hidden');
  delugeSection.classList.remove('hidden');
  activeSearchQueryTitle.innerText = "Gerenciador Deluge";
  
  renderSearchesList();
  
  // Inicia SSE para atualização em tempo real
  setupDelugeSSE();
}

function showMonitoredSection() {
  activeSearchId = null;
  closeSSE();
  closeDelugeSSE();

  newSearchSection.classList.add('hidden');
  activeSearchSection.classList.add('hidden');
  settingsSection.classList.add('hidden');
  delugeSection.classList.add('hidden');
  if (monitoredSection) monitoredSection.classList.remove('hidden');
  activeSearchQueryTitle.innerText = "Páginas Monitoradas";

  renderSearchesList();
  fetchMonitoredPages();
}



async function checkDelugeStatus() {

  try {

    const res = await fetch('/api/deluge/status');

    const data = await res.json();

    delugeOnline = data.disponivel;

    

    if (delugeOnline) {

      delugeStatusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20";

      delugeStatusDot.title = `Deluge Online (Porta: ${data.port})`;

      

      delugePanelStatusBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";

      delugePanelStatusBadge.innerText = "Online";

      delugePanelOfflineAlert.classList.add('hidden');

    } else {

      delugeStatusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";

      delugeStatusDot.title = "Deluge Offline ou Indisponível";

      

      delugePanelStatusBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/10 text-red-600 border border-red-500/20";

      delugePanelStatusBadge.innerText = "Offline";

      delugePanelOfflineAlert.classList.remove('hidden');

    }

  } catch (err) {

    delugeOnline = false;

    delugeStatusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";

    delugeStatusDot.title = "Erro de conexão com o painel Deluge";

  }

}



async function fetchDelugeTorrents() {
  const originalHtml = refreshDelugeBtn ? refreshDelugeBtn.innerHTML : null;
  if (refreshDelugeBtn) {
    if (refreshDelugeBtn.disabled) return;
    refreshDelugeBtn.disabled = true;
    refreshDelugeBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Atualizando...`;
  }

  // Tenta carregar cache local instantaneamente (SWR no cliente)
  const cached = localStorage.getItem('cached_deluge_torrents');
  if (cached) {
    try {
      delugeTorrentsCache = JSON.parse(cached);
      renderDelugeTorrents(delugeTorrentsCache);
    } catch (e) {}
  }

  await checkDelugeStatus();
  
  if (!delugeOnline) {
    delugeTorrentsContainer.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500 shadow-sm">
        <i class="ph-bold ph-warning text-3xl mb-2 text-amber-500 opacity-60"></i>
        <h4 class="font-bold text-slate-700 dark:text-slate-350">Deluge não disponível</h4>
        <p class="text-xs max-w-sm mx-auto mt-1">Não foi possível obter a listagem de torrents pois o serviço Deluge está offline.</p>
      </div>`;
      
    delugeStatTotal.innerText = '0';
    delugeStatDownloading.innerText = '0';
    delugeStatDlSpeed.innerText = '0 KB/s';
    delugeStatUlSpeed.innerText = '0 KB/s';
    if (refreshDelugeBtn) {
      refreshDelugeBtn.disabled = false;
      refreshDelugeBtn.innerHTML = originalHtml;
    }
    return;
  }

  try {
    const res = await fetch('/api/deluge/torrents');
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erro ao obter torrents");
    }

    delugeTorrentsCache = data.torrents || {};
    localStorage.setItem('cached_deluge_torrents', JSON.stringify(delugeTorrentsCache));
    renderDelugeTorrents(delugeTorrentsCache);
  } catch (err) {
    console.error("Erro ao buscar torrents:", err);
  } finally {
    if (refreshDelugeBtn) {
      refreshDelugeBtn.disabled = false;
      refreshDelugeBtn.innerHTML = originalHtml;
    }
  }
}

function renderDelugeTorrents(torrents) {
  const ids = Object.keys(torrents);
  const searchQuery = (searchDelugeInput?.value || '').toLowerCase().trim();
  const filteredIds = searchQuery
    ? ids.filter(id => torrents[id].name.toLowerCase().includes(searchQuery))
    : ids;

  // Calcular estatísticas globais
  let total = ids.length;
  let downloading = 0;
  let totalDlRate = 0;
  let totalUlRate = 0;

  ids.forEach(id => {
    const t = torrents[id];
    if (t.state === 'Downloading') downloading++;
    totalDlRate += t.download_payload_rate || 0;
    totalUlRate += t.upload_payload_rate || 0;
  });

  delugeStatTotal.innerText = total;
  delugeStatDownloading.innerText = downloading;
  delugeStatDlSpeed.innerText = formatSpeedBytes(totalDlRate) + '/s';
  delugeStatUlSpeed.innerText = formatSpeedBytes(totalUlRate) + '/s';

  if (filteredIds.length === 0) {
    if (total === 0) {
      delugeTorrentsContainer.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500 shadow-sm">
          <i class="ph-bold ph-download-simple text-3xl mb-2 text-brand-500 opacity-60"></i>
          <h4 class="font-bold text-slate-700 dark:text-slate-350">Nenhum torrent em andamento</h4>
          <p class="text-xs max-w-sm mx-auto mt-1">Os torrents adicionados aparecerão listados aqui em tempo real.</p>
        </div>`;
    } else {
      delugeTorrentsContainer.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500 shadow-sm">
          <i class="ph-bold ph-magnifying-glass text-3xl mb-2 text-brand-500 opacity-60"></i>
          <h4 class="font-bold text-slate-700 dark:text-slate-350">Nenhum torrent encontrado</h4>
          <p class="text-xs max-w-sm mx-auto mt-1">Nenhum resultado corresponde à busca "${searchQuery}".</p>
        </div>`;
    }
    return;
  }

  // Renderizar lista de torrents (Layout flexível otimizado para celular e desktop)
  delugeTorrentsContainer.innerHTML = filteredIds.map(id => {
    const t = torrents[id];
    const progressPercent = (t.progress || 0).toFixed(1);
    
    let stateBadgeColor = 'bg-slate-100 text-slate-650 dark:bg-slate-950 dark:text-slate-400';
    if (t.state === 'Downloading') stateBadgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    else if (t.state === 'Seeding') stateBadgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    else if (t.state === 'Paused') stateBadgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    else if (t.state === 'Error') stateBadgeColor = 'bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20';

    const playPauseButton = t.paused
      ? `<button onclick="resumeDelugeTorrent('${id}')" class="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 transition-all cursor-pointer" title="Retomar Download"><i class="ph-bold ph-play text-sm"></i></button>`
      : `<button onclick="pauseDelugeTorrent('${id}')" class="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-650 dark:text-amber-400 rounded-xl border border-amber-500/20 transition-all cursor-pointer" title="Pausar Download"><i class="ph-bold ph-pause text-sm"></i></button>`;

    return `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="space-y-1 flex-1 min-w-0">
            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug break-words" title="&apos;${t.name}&apos;">${t.name}</h4>
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${stateBadgeColor}">${t.state}</span>
              <span class="text-xs text-slate-400 font-medium">Tamanho: ${formatBytesSize(t.total_done)} / ${formatBytesSize(t.total_size)}</span>
              <span class="text-xs text-slate-400 font-medium">• Ratio: ${t.ratio.toFixed(2)}</span>
            </div>
          </div>
          
          <!-- Ações Rápidas (Pausar/Retomar e Excluir) -->
          <div class="flex items-center gap-2 self-start sm:self-auto mt-2 sm:mt-0 flex-shrink-0">
            ${playPauseButton}
            <button onclick="openDelugeRemoveModal('${id}', '${t.name.replace(/'/g, "\\'")}')" class="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all cursor-pointer" title="Remover Torrent"><i class="ph-bold ph-trash text-sm"></i></button>
          </div>
        </div>

        <!-- Barra de Progresso e Métricas -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-slate-500 dark:text-slate-450">${progressPercent}% concluído</span>
            <span class="text-slate-450 font-mono text-[11px]">ETA: ${formatETAString(t.eta)}</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-200/50 dark:border-slate-850">
            <div class="bg-gradient-to-r from-brand-500 to-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Velocidades e Conectividade -->
        <div class="flex items-center justify-between text-[11px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-850/50 gap-2 flex-wrap sm:flex-nowrap">
          <span class="flex items-center gap-1"><i class="ph-bold ph-arrow-down text-blue-500"></i> DL: ${formatSpeedBytes(t.download_payload_rate)}/s</span>
          <span class="flex items-center gap-1"><i class="ph-bold ph-arrow-up text-emerald-500"></i> UL: ${formatSpeedBytes(t.upload_payload_rate)}/s</span>
          <span class="flex items-center gap-1"><i class="ph-bold ph-users"></i> Seeds: ${t.num_seeds} | Peers: ${t.num_peers}</span>
        </div>
      </div>`;
  }).join('');
}


function showDelugeToast(message, type = 'success') {
  // Remove toast existente
  const existing = document.getElementById('delugeToast');
  if (existing) existing.remove();

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    error:   'bg-red-500/10 border-red-500/30 text-red-400',
  };
  const icons = {
    success: 'ph-check-circle',
    warning: 'ph-warning-circle',
    error:   'ph-x-circle',
  };

  const toast = document.createElement('div');
  toast.id = 'delugeToast';
  toast.className = `fixed bottom-6 right-6 z-[999] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl text-sm font-semibold backdrop-blur-sm ${colors[type] || colors.success} transition-all duration-300 opacity-0 translate-y-4`;
  toast.innerHTML = `<i class="ph-bold ${icons[type] || icons.success} text-lg"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-y-4');
    });
  });

  // Auto-remove after 4s
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

async function sendToDeluge(magnetLink, buttonEl, size = '') {

  try {

    const origHtml = buttonEl.innerHTML;

    buttonEl.disabled = true;

    buttonEl.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Enviando...`;

    

    const res = await fetch('/api/deluge/add', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ magnetLink, size })

    });

    const data = await res.json();

    

    if (data.success) {

      if (data.alreadyExists) {
        showDelugeToast('Torrent já está na fila do Deluge.', 'warning');
        buttonEl.innerHTML = `<i class="ph-bold ph-warning text-sm"></i> Já existe`;
      } else {
        showDelugeToast('Torrent adicionado ao Deluge com sucesso!', 'success');
        buttonEl.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Enviado!`;
      }

      buttonEl.className = buttonEl.className.replace('bg-emerald-600', 'bg-emerald-500').replace('hover:bg-emerald-700', 'hover:bg-emerald-600');

      

      setTimeout(() => {

        buttonEl.disabled = false;

        buttonEl.innerHTML = origHtml;

        buttonEl.className = buttonEl.className.replace('bg-emerald-500', 'bg-emerald-600').replace('hover:bg-emerald-650', 'hover:bg-emerald-700');

      }, 2000);

      

      // Se estiver na tela do Deluge, atualiza a lista

      if (!delugeSection.classList.contains('hidden')) {

        fetchDelugeTorrents();

      }

    } else {

      throw new Error(data.error || "Erro desconhecido");

    }

  } catch (err) {

    showDelugeToast('Erro ao enviar torrent: ' + err.message, 'error');

    buttonEl.disabled = false;

  }

}



async function downloadAllTorrentsInDeluge() {

  if (activeSearchData.results.length === 0) return;

  const magnets = activeSearchData.results.map(r => r.magnetLink);
  const items = activeSearchData.results.map(r => ({ magnetLink: r.magnetLink, size: r.size }));

  

  try {

    const origHtml = downloadAllDelugeBtn.innerHTML;

    downloadAllDelugeBtn.disabled = true;

    downloadAllDelugeBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Adicionando todos...`;

    

    const res = await fetch('/api/deluge/add-multiple', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ magnetLinks: magnets, items })

    });

    const data = await res.json();

    

    if (data.success) {

      downloadAllDelugeBtn.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Todos Enviados!`;

      downloadAllDelugeBtn.className = downloadAllDelugeBtn.className.replace('bg-emerald-600', 'bg-emerald-500').replace('hover:bg-emerald-700', 'hover:bg-emerald-600');

      

      setTimeout(() => {

        downloadAllDelugeBtn.disabled = false;

        downloadAllDelugeBtn.innerHTML = origHtml;

        downloadAllDelugeBtn.className = downloadAllDelugeBtn.className.replace('bg-emerald-500', 'bg-emerald-600').replace('hover:bg-emerald-600', 'hover:bg-emerald-700');

      }, 3000);

      

      if (!delugeSection.classList.contains('hidden')) {

        fetchDelugeTorrents();

      }

    } else {

      throw new Error(data.error || "Erro desconhecido");

    }

  } catch (err) {

    await alert("Erro ao enviar múltiplos torrents: " + err.message);

    downloadAllDelugeBtn.disabled = false;

  }

}



async function pauseDelugeTorrent(id) {

  try {

    const res = await fetch(`/api/deluge/torrents/${id}/pause`, { method: 'POST' });

    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    fetchDelugeTorrents();

  } catch (err) {

    await alert("Erro ao pausar torrent: " + err.message);

  }

}



async function resumeDelugeTorrent(id) {

  try {

    const res = await fetch(`/api/deluge/torrents/${id}/resume`, { method: 'POST' });

    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    fetchDelugeTorrents();

  } catch (err) {

    await alert("Erro ao retomar torrent: " + err.message);

  }

}



function openDelugeAddUrlModal() {
  if (!delugeAddUrlModal) return;
  if (delugeUrlInput) delugeUrlInput.value = '';
  if (delugeAddUrlStatus) {
    delugeAddUrlStatus.classList.add('hidden');
    delugeAddUrlStatus.innerHTML = '';
  }
  const container = document.getElementById('delugeFoundTorrentsContainer');
  const list = document.getElementById('delugeFoundTorrentsList');
  if (container) container.classList.add('hidden');
  if (list) list.innerHTML = '';

  delugeAddUrlModal.classList.remove('hidden');
  if (delugeUrlInput) delugeUrlInput.focus();
}

function closeDelugeAddUrlModal() {
  if (!delugeAddUrlModal) return;
  delugeAddUrlModal.classList.add('hidden');
}

async function handleDelugeAddUrlSubmit(e) {
  e.preventDefault();
  const urlVal = delugeUrlInput ? delugeUrlInput.value.trim() : '';
  if (!urlVal) return;

  submitDelugeAddUrlBtn.disabled = true;
  const origBtnText = submitDelugeAddUrlBtn.innerHTML;
  submitDelugeAddUrlBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Processando...`;

  const container = document.getElementById('delugeFoundTorrentsContainer');
  const countEl = document.getElementById('delugeFoundTorrentsCount');
  const listEl = document.getElementById('delugeFoundTorrentsList');

  if (container) container.classList.add('hidden');
  if (listEl) listEl.innerHTML = '';

  if (delugeAddUrlStatus) {
    delugeAddUrlStatus.classList.remove('hidden');
    delugeAddUrlStatus.className = "text-xs p-3 rounded-xl flex items-center gap-2 font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
    delugeAddUrlStatus.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-emerald-500"></i> Extraindo torrents e adicionando ao Deluge...`;
  }

  try {
    const isMonitorChecked = delugeMonitorCheck ? delugeMonitorCheck.checked : true;
    const res = await fetch('/api/deluge/add-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlVal, monitor: isMonitorChecked })
    });

    const data = await res.json();

    if (data.success) {
      const { totalFound, addedCount, existingCount, results } = data;
      let msg = '';
      if (addedCount > 0) {
        msg = `${addedCount} torrent(s) adicionado(s) com sucesso para download!`;
        if (existingCount > 0) msg += ` (${existingCount} já existia(m))`;
      } else if (existingCount > 0) {
        msg = `Os ${existingCount} torrent(s) encontrado(s) já estão adicionados no Deluge.`;
      } else {
        msg = `Nenhum torrent novo foi adicionado.`;
      }

      if (delugeAddUrlStatus) {
        delugeAddUrlStatus.className = "text-xs p-3 rounded-xl flex items-center gap-2 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
        delugeAddUrlStatus.innerHTML = `<i class="ph-bold ph-check-circle text-base"></i> ${msg}`;
      }

      // Renderiza a lista de torrents com seus títulos e status
      if (results && results.length > 0 && listEl) {
        if (countEl) countEl.innerText = totalFound;

        listEl.innerHTML = results.map(item => {
          let badgeHtml = '';
          if (item.success && !item.alreadyExists) {
            badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i class="ph-bold ph-check text-[10px]"></i> Baixando</span>`;
          } else if (item.alreadyExists) {
            badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1"><i class="ph-bold ph-warning text-[10px]"></i> No Deluge</span>`;
          } else {
            badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1" title="${escapeHtml(item.error || '')}"><i class="ph-bold ph-x text-[10px]"></i> Erro</span>`;
          }

          const safeTitle = escapeHtml(item.title || 'Torrent Sem Título');
          const magnetPreview = escapeHtml(item.magnet || '');

          return `
            <div class="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs transition-all hover:border-emerald-500/40">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                  <i class="ph-bold ph-magnet text-sm"></i>
                </div>
                <div class="truncate">
                  <span class="font-bold text-slate-800 dark:text-slate-100 block truncate" title="${safeTitle}">${safeTitle}</span>
                  <span class="text-[10px] font-mono text-slate-400 truncate block opacity-75">${magnetPreview.substring(0, 50)}...</span>
                </div>
              </div>
              <div class="shrink-0">
                ${badgeHtml}
              </div>
            </div>
          `;
        }).join('');

        if (container) container.classList.remove('hidden');
      }

      if (typeof fetchDelugeTorrents === 'function') fetchDelugeTorrents();
      if (typeof showDelugeToast === 'function') showDelugeToast(msg, addedCount > 0 ? 'success' : 'warning');
    } else {
      if (delugeAddUrlStatus) {
        delugeAddUrlStatus.className = "text-xs p-3 rounded-xl flex items-center gap-2 font-medium bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20";
        delugeAddUrlStatus.innerHTML = `<i class="ph-bold ph-warning-circle text-base"></i> ${data.error || 'Erro ao processar URL/Magnet Link.'}`;
      }
    }
  } catch (err) {
    if (delugeAddUrlStatus) {
      delugeAddUrlStatus.className = "text-xs p-3 rounded-xl flex items-center gap-2 font-medium bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20";
      delugeAddUrlStatus.innerHTML = `<i class="ph-bold ph-warning-circle text-base"></i> Erro de conexão: ${err.message}`;
    }
  } finally {
    submitDelugeAddUrlBtn.disabled = false;
    submitDelugeAddUrlBtn.innerHTML = origBtnText;
  }
}

function openDelugeRemoveModal(id, name) {

  delugeRemoveTargetId = id;

  delugeRemoveTorrentName.innerText = name;

  delugeRemoveModal.classList.remove('hidden');

}



function closeDelugeRemoveModal() {

  delugeRemoveModal.classList.add('hidden');

  delugeRemoveTargetId = null;

}



async function confirmRemoveTorrent(deleteData) {

  if (!delugeRemoveTargetId) return;

  

  try {

    const res = await fetch(`/api/deluge/torrents/${delugeRemoveTargetId}/remove`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ removeData: deleteData })

    });

    const data = await res.json();

    

    if (data.success) {

      closeDelugeRemoveModal();

      fetchDelugeTorrents();

    } else {

      throw new Error(data.error || "Erro ao remover torrent");

    }

  } catch (err) {

    await alert("Erro ao remover torrent: " + err.message);

  }

}



function formatBytesSize(bytes) {

  if (!bytes || bytes === 0) return '0 Bytes';

  const k = 1024;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];

}



function formatSpeedBytes(bytes) {

  if (!bytes || bytes === 0) return '0 KB';

  const k = 1024;

  const sizes = ['B', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];

}



function formatETAString(seconds) {

  if (!seconds || seconds <= 0) return 'N/A';

  const h = Math.floor(seconds / 3600);

  const m = Math.floor((seconds % 3600) / 60);

  const s = Math.floor(seconds % 60);

  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;

}



async function clearDelugeErrors() {
  const torrents = delugeTorrentsCache || {};
  const errorTorrents = Object.keys(torrents).filter(id => torrents[id].state === 'Error');
  
  if (errorTorrents.length === 0) {
    await alert("Nenhum torrent com erro foi detectado no momento.");
    return;
  }
  
  const confirmClean = await confirm(`Deseja remover todos os ${errorTorrents.length} torrents em estado de erro? Esta ação também excluirá os arquivos no disco e é irreversível.`);
  if (!confirmClean) return;
  
  try {
    clearDelugeErrorsBtn.disabled = true;
    const origText = clearDelugeErrorsBtn.innerHTML;
    clearDelugeErrorsBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Apagando...`;
    
    const res = await fetch('/api/deluge/torrents/remove-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeData: true })
    });
    
    const data = await res.json();
    if (data.success) {
      await alert(`${data.count} torrent(s) com erro foram removidos com sucesso.`);
      fetchDelugeTorrents();
    } else {
      throw new Error(data.error || "Erro ao apagar torrents");
    }
  } catch (err) {
    await alert("Erro ao remover torrents com erro: " + err.message);
  } finally {
    clearDelugeErrorsBtn.disabled = false;
    clearDelugeErrorsBtn.innerHTML = `<i class="ph-bold ph-trash"></i> Apagar Erros`;
  }
}

// --- OTIMIZADOR DE FONTES DE BUSCA COM IA ---

let currentAnalysisSourceId = null;
let currentAnalysisResult = null;
let currentAnalysisAbortController = null;
let analyzeEventSource = null;

// Analisa uma URL temporária (não cadastrada)
async function analyzeSourceUrl(url, name = '') {
  currentAnalysisSourceId = -1; // ID especial para novos temporários
  currentAnalysisResult = null;

  // Mostra modal, reseta states
  sourceAnalysisModal.classList.remove('hidden');
  analysisLoadingState.classList.remove('hidden');
  analysisResultState.classList.add('hidden');
  analysisErrorState.classList.add('hidden');
  applyAnalysisBtn.classList.add('hidden');
  retryAnalysisBtn.classList.add('hidden');

  // Logs iniciais
  analysisStatusTitle.innerText = "Iniciando análise...";
  analysisLogs.innerHTML = "";
  
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    analysisLogs.innerHTML += `<div>[${time}] ${msg}</div>`;
    analysisLogs.scrollTop = analysisLogs.scrollHeight;
  };

  addLog(`Conectando ao canal de log em tempo real...`);
  
  // Conecta ao stream SSE de logs de análise
  if (analyzeEventSource) analyzeEventSource.close();
  analyzeEventSource = new EventSource('/api/sources/analyze/stream');
  
  analyzeEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.sourceId === -1) {
        analysisStatusTitle.innerText = data.message;
        addLog(data.message);
      }
    } catch (err) {
      console.error("Erro ao ler log de análise:", err);
    }
  };

  analyzeEventSource.onerror = () => {};

  try {
    if (currentAnalysisAbortController) currentAnalysisAbortController.abort();
    currentAnalysisAbortController = new AbortController();

    const res = await fetch(`/api/sources/analyze-url`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
      signal: currentAnalysisAbortController.signal
    });
    
    if (analyzeEventSource) {
      analyzeEventSource.close();
      analyzeEventSource = null;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Erro desconhecido na análise");
    }

    const result = await res.json();
    if (!result.success || !result.analysis) {
      throw new Error(result.error || "A IA não conseguiu determinar a estratégia do site.");
    }

    currentAnalysisResult = result.analysis;
    const tempSourceObj = {
      name: result.analysis.siteName || name || new URL(url).hostname || 'Nova Fonte',
      url: url,
      searchUrlPattern: url,
      description: '',
      contentTypes: []
    };
    showAnalysisResult(tempSourceObj, result.analysis);
  } catch (err) {
    if (analyzeEventSource) {
      analyzeEventSource.close();
      analyzeEventSource = null;
    }
    if (err.name === 'AbortError') {
      addLog("Análise cancelada pelo usuário.");
      return;
    }
    showAnalysisError(err.message);
  } finally {
    currentAnalysisAbortController = null;
  }
}

// Analisa um site individualmente
async function analyzeSource(id) {
  const source = searchSources.find(s => s.id === id);
  if (!source) return;

  currentAnalysisSourceId = id;
  currentAnalysisResult = null;

  // Mostra modal, reseta states
  sourceAnalysisModal.classList.remove('hidden');
  analysisLoadingState.classList.remove('hidden');
  analysisResultState.classList.add('hidden');
  analysisErrorState.classList.add('hidden');
  applyAnalysisBtn.classList.add('hidden');
  retryAnalysisBtn.classList.add('hidden');

  // Logs iniciais
  analysisStatusTitle.innerText = "Iniciando análise...";
  analysisLogs.innerHTML = "";
  
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    analysisLogs.innerHTML += `<div>[${time}] ${msg}</div>`;
    analysisLogs.scrollTop = analysisLogs.scrollHeight;
  };

  addLog(`Conectando ao canal de log em tempo real...`);
  
  // Conecta ao stream SSE de logs de análise
  if (analyzeEventSource) analyzeEventSource.close();
  analyzeEventSource = new EventSource('/api/sources/analyze/stream');
  
  analyzeEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.sourceId === id) {
        analysisStatusTitle.innerText = data.message;
        addLog(data.message);
      }
    } catch (err) {
      console.error("Erro ao ler log de análise:", err);
    }
  };

  analyzeEventSource.onerror = () => {
    // Silencioso se estiver fechando ou reconectando
  };

  try {
    if (currentAnalysisAbortController) currentAnalysisAbortController.abort();
    currentAnalysisAbortController = new AbortController();

    const res = await fetch(`/api/sources/${id}/analyze`, { 
      method: 'POST',
      signal: currentAnalysisAbortController.signal
    });
    
    if (analyzeEventSource) {
      analyzeEventSource.close();
      analyzeEventSource = null;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Erro desconhecido na análise");
    }

    const result = await res.json();
    if (!result.success || !result.analysis) {
      throw new Error(result.error || "A IA não conseguiu determinar a estratégia do site.");
    }

    currentAnalysisResult = result.analysis;
    showAnalysisResult(source, result.analysis);
  } catch (err) {
    if (analyzeEventSource) {
      analyzeEventSource.close();
      analyzeEventSource = null;
    }
    if (err.name === 'AbortError') {
      addLog("Análise cancelada pelo usuário.");
      return;
    }
    showAnalysisError(err.message);
  } finally {
    currentAnalysisAbortController = null;
  }
}

function showAnalysisResult(source, rawAnalysis) {
  // Normalização defensiva dos dados da análise para o frontend
  const analysis = {
    strategyType: rawAnalysis.strategyType || 'unknown',
    detectedPattern: rawAnalysis.detectedPattern || source.searchUrlPattern || "",
    explanation: rawAnalysis.explanation || "Nenhuma explicação fornecida pela IA.",
    optimizedDescription: rawAnalysis.optimizedDescription || source.description || "",
    contentTypes: rawAnalysis.contentTypes || source.contentTypes || []
  };

  analysisLoadingState.classList.add('hidden');
  analysisErrorState.classList.add('hidden');
  analysisResultState.classList.remove('hidden');
  applyAnalysisBtn.classList.remove('hidden');
  retryAnalysisBtn.classList.add('hidden');

  analysisSourceName.innerText = source.name;
  analysisSourceUrl.innerText = source.url;

  // Tradução do StrategyType
  const strategyLabels = {
    'query_url': 'URL com Query de Busca',
    'api_route': 'Rota de API / AJAX',
    'input_selector': 'Digitação em Seletor',
    'unknown': 'Desconhecida'
  };
  analysisStrategyBadge.innerText = strategyLabels[analysis.strategyType] || analysis.strategyType;

  analysisExplanation.innerText = analysis.explanation;
  analysisPatternOld.innerText = source.searchUrlPattern || '(Nenhum)';
  analysisPatternNew.innerText = analysis.detectedPattern;
  
  // Se o padrão recomendado for diferente, destaca
  if (source.searchUrlPattern !== analysis.detectedPattern) {
    analysisPatternNew.className = "p-2.5 bg-indigo-500/10 border border-indigo-500/40 rounded-xl text-xs font-mono text-indigo-600 dark:text-indigo-400 break-all font-bold";
  } else {
    analysisPatternNew.className = "p-2.5 bg-slate-100 dark:bg-slate-800/45 rounded-xl text-xs font-mono text-slate-500 dark:text-slate-400 break-all";
  }

  analysisDescription.value = analysis.optimizedDescription || '';

  // Renderiza tipos de conteúdo recomendados
  const contentTypesHtml = (analysis.contentTypes || []).map(t => {
    let label = t;
    let color = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    if (t === 'series') { label = 'Séries'; color = 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400'; }
    if (t === 'movies') { label = 'Filmes'; color = 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400'; }
    if (t === 'book') { label = 'Livros'; color = 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'; }
    if (t === 'music') { label = 'Músicas'; color = 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'; }
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}">${label}</span>`;
  }).join(' ');

  analysisContentTypes.innerHTML = contentTypesHtml || '<span class="text-slate-500 text-[10px]">Nenhum sugerido</span>';

  // Configura botão de aplicar
  applyAnalysisBtn.onclick = () => applyAnalysisResult(currentAnalysisSourceId, analysis);
}

function showAnalysisError(msg) {
  analysisLoadingState.classList.add('hidden');
  analysisResultState.classList.add('hidden');
  analysisErrorState.classList.remove('hidden');
  applyAnalysisBtn.classList.add('hidden');
  retryAnalysisBtn.classList.remove('hidden');

  analysisErrorMsg.innerText = msg;
  retryAnalysisBtn.onclick = () => {
    if (currentAnalysisSourceId === -1) {
      analyzeSourceUrl(sourceUrlInput.value.trim(), sourceNameInput.value.trim());
    } else {
      analyzeSource(currentAnalysisSourceId);
    }
  };
}

// Aplica o resultado da análise salvando no DB ou preenchendo o modal
async function applyAnalysisResult(id, analysis) {
  const isSourceModalVisible = sourceModal && !sourceModal.classList.contains('hidden');
  
  if (id === -1 || isSourceModalVisible) {
    if (analysis.siteName) {
      sourceNameInput.value = analysis.siteName;
    } else if (!sourceNameInput.value) {
      try {
        sourceNameInput.value = new URL(sourceUrlInput.value).hostname;
      } catch (e) {
        sourceNameInput.value = sourceUrlInput.value;
      }
    }
    sourcePatternInput.value = analysis.detectedPattern || sourceUrlInput.value;
    sourceDescriptionInput.value = analysis.optimizedDescription || '';
    
    // Checkboxes of contentTypes
    const contentTypes = analysis.contentTypes || [];
    const checkboxes = sourceForm.querySelectorAll('input[name="contentTypes"]');
    checkboxes.forEach(cb => {
      cb.checked = contentTypes.includes(cb.value);
    });

    showDelugeToast("Campos do formulário preenchidos com a otimização da IA!", "success");
    sourceAnalysisModal.classList.add('hidden');
    return;
  }

  const source = searchSources.find(s => s.id === id);
  if (!source) return;

  const originalBtnHtml = applyAnalysisBtn.innerHTML;
  applyAnalysisBtn.disabled = true;
  applyAnalysisBtn.innerText = "Salvando...";

  try {
    const res = await fetch(`/api/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: source.name,
        url: source.url,
        searchUrlPattern: analysis.detectedPattern,
        description: analysisDescription.value.trim(),
        contentTypes: analysis.contentTypes,
        isActive: analysis.isActive !== undefined ? analysis.isActive : source.isActive
      })
    });

    if (!res.ok) throw new Error("Erro ao salvar otimizações no servidor.");

    showDelugeToast("Fonte de busca otimizada com sucesso!", "success");
    sourceAnalysisModal.classList.add('hidden');
    await fetchSources(); // Recarrega tabela
  } catch (err) {
    showDelugeToast(err.message, "error");
  } finally {
    applyAnalysisBtn.disabled = false;
    applyAnalysisBtn.innerHTML = originalBtnHtml;
  }
}

// Cancela análise atual e fecha modal
async function cancelAnalysisAndClose() {
  if (currentAnalysisSourceId) {
    if (currentAnalysisAbortController) {
      currentAnalysisAbortController.abort();
    }
    // Notifica backend para parar Puppeteer
    const cancelUrl = currentAnalysisSourceId === -1 
      ? `/api/sources/analyze-url/cancel` 
      : `/api/sources/${currentAnalysisSourceId}/analyze/cancel`;
    fetch(cancelUrl, { method: 'POST' }).catch(() => {});
  }
  
  if (analyzeEventSource) {
    analyzeEventSource.close();
    analyzeEventSource = null;
  }
  
  sourceAnalysisModal.classList.add('hidden');
  currentAnalysisSourceId = null;
  currentAnalysisAbortController = null;
}

// Otimiza todas as fontes ativas sequencialmente
let batchEventSource = null;
let isBatchCancelled = false;

async function analyzeAllSources() {
  // Ordena para começar pelos desativados (isActive = false primeiro)
  const sortedSources = [...searchSources].sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? 1 : -1;
  });

  if (sortedSources.length === 0) {
    showDelugeToast("Nenhum site cadastrado para otimizar.", "warning");
    return;
  }

  isBatchCancelled = false;
  batchAnalysisModal.classList.remove('hidden');
  batchProgressText.innerText = `0 / ${sortedSources.length} Sites`;
  batchProgressBar.style.width = '0%';
  
  // Configura botões do footer
  cancelBatchBtn.classList.remove('hidden');
  closeBatchBtn.classList.add('hidden');

  // Popula lista de sites
  batchSitesList.innerHTML = sortedSources.map(source => `
    <div id="batch-row-${source.id}" class="p-3.5 flex flex-col gap-2 text-xs transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/80">
      <div class="flex items-center justify-between">
        <div>
          <span class="font-bold text-slate-700 dark:text-slate-350">${source.name}</span>
          <p class="text-[10px] text-slate-400 font-mono mt-0.5 break-all max-w-sm">${source.url}</p>
        </div>
        <div class="flex items-center gap-1.5" id="batch-status-${source.id}">
          <i class="ph-bold ph-circle text-[8px] text-slate-300 dark:text-slate-700"></i>
          <span class="text-[10px] text-slate-450 dark:text-slate-500 font-bold">Aguardando...</span>
        </div>
      </div>
      <!-- Caixa de logs em tempo real -->
      <div id="batch-log-${source.id}" class="hidden w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-lg p-2 font-mono text-[9px] text-slate-550 dark:text-slate-400 max-h-24 overflow-y-auto mt-1">
      </div>
      <!-- Caixa de comparação do diff final -->
      <div id="batch-diff-${source.id}" class="hidden w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-lg text-[10px] space-y-1.5 mt-1.5">
      </div>
    </div>
  `).join('');

  // Conecta ao SSE de logs globais
  if (batchEventSource) batchEventSource.close();
  batchEventSource = new EventSource('/api/sources/analyze/stream');
  
  batchEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const logBox = document.getElementById(`batch-log-${data.sourceId}`);
      if (logBox) {
        logBox.classList.remove('hidden');
        const time = new Date().toLocaleTimeString();
        logBox.innerHTML += `<div>[${time}] ${data.message}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
      }
    } catch (err) {
      console.error("Erro no streaming de logs em lote:", err);
    }
  };

  let completed = 0;

  // Lógica do botão de cancelar lote
  cancelBatchBtn.onclick = async () => {
    isBatchCancelled = true;
    
    // Se houver uma análise rodando, cancela ela
    if (sortedSources[completed]) {
      const runningSource = sortedSources[completed];
      if (currentAnalysisAbortController) {
        currentAnalysisAbortController.abort();
      }
      fetch(`/api/sources/${runningSource.id}/analyze/cancel`, { method: 'POST' }).catch(() => {});
    }

    if (batchEventSource) {
      batchEventSource.close();
      batchEventSource = null;
    }

    showDelugeToast("Análise em lote cancelada pelo usuário.", "warning");

    // Preenche status de cancelado nos restantes
    for (let i = completed; i < sortedSources.length; i++) {
      const s = sortedSources[i];
      const statusEl = document.getElementById(`batch-status-${s.id}`);
      const rowEl = document.getElementById(`batch-row-${s.id}`);
      if (statusEl && rowEl) {
        rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-slate-500/5 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
        statusEl.innerHTML = `
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold mr-1.5">Cancelado</span>
          <i class="ph-bold ph-x-circle text-lg text-slate-400"></i>
        `;
      }
    }

    cancelBatchBtn.classList.add('hidden');
    closeBatchBtn.classList.remove('hidden');
  };

  for (const source of sortedSources) {
    if (isBatchCancelled) break;

    const statusContainer = document.getElementById(`batch-status-${source.id}`);
    const rowEl = document.getElementById(`batch-row-${source.id}`);
    const logBox = document.getElementById(`batch-log-${source.id}`);
    
    rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-indigo-500/5 dark:bg-indigo-950/10 border-b border-slate-200 dark:border-slate-800 transition-colors duration-150";
    statusContainer.innerHTML = `
      <i class="ph-bold ph-circle-notch animate-spin text-indigo-500"></i>
      <span class="text-[10px] text-indigo-500 font-bold">Analisando...</span>
    `;
    if (logBox) logBox.classList.remove('hidden');

    try {
      if (currentAnalysisAbortController) currentAnalysisAbortController.abort();
      currentAnalysisAbortController = new AbortController();

      currentAnalysisSourceId = source.id;
      const res = await fetch(`/api/sources/${source.id}/analyze`, { 
        method: 'POST',
        signal: currentAnalysisAbortController.signal
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        if (result.isConnectionError) {
          rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-red-500/5 dark:bg-red-950/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
          statusContainer.innerHTML = `
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 font-bold mr-1.5" title="${result.error}">Inacessível (Desativado)</span>
            <i class="ph-bold ph-warning-circle text-lg text-red-500" title="${result.error}"></i>
          `;
          if (logBox) logBox.classList.add('hidden');
          completed++;
          batchProgressText.innerText = `${completed} / ${sortedSources.length} Sites`;
          batchProgressBar.style.width = `${(completed / sortedSources.length) * 100}%`;
          continue;
        }
        throw new Error(result.error || "A IA falhou em analisar.");
      }

      const result = await res.json();
      const analysis = {
        detectedPattern: result.analysis.detectedPattern || source.searchUrlPattern || "",
        optimizedDescription: result.analysis.optimizedDescription || source.description || "",
        explanation: result.analysis.explanation || "Nenhuma explicação fornecida pela IA.",
        contentTypes: result.analysis.contentTypes || source.contentTypes || [],
        isActive: result.analysis.isActive !== undefined ? result.analysis.isActive : source.isActive
      };
      
      // Oculta log box se terminou com sucesso para limpar layout e focar no diff
      if (logBox) logBox.classList.add('hidden');
      
      const hasPatternDiff = source.searchUrlPattern !== analysis.detectedPattern;
      const hasDescriptionDiff = source.description !== analysis.optimizedDescription;
      
      // Auto-aplica as otimizações
      const updateRes = await fetch(`/api/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: source.name,
          url: source.url,
          searchUrlPattern: analysis.detectedPattern,
          description: analysis.optimizedDescription || source.description,
          contentTypes: analysis.contentTypes || source.contentTypes,
          isActive: analysis.isActive
        })
      });

      if (!updateRes.ok) throw new Error("Erro ao salvar atualizações");

      // Sucesso! Atualiza UI da linha com comparativo de diferenças
      if (!analysis.isActive) {
        rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-red-500/5 dark:bg-red-950/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
        statusContainer.innerHTML = `
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 font-bold mr-1.5">Desativado</span>
          <i class="ph-bold ph-warning-circle text-lg text-red-500"></i>
        `;
      } else if (hasPatternDiff || hasDescriptionDiff) {
        rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-emerald-500/5 dark:bg-emerald-950/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
        statusContainer.innerHTML = `
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold mr-1.5">Otimizado</span>
          <i class="ph-bold ph-check-circle text-lg text-emerald-500"></i>
        `;
      } else {
        rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-slate-500/5 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
        statusContainer.innerHTML = `
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold mr-1.5">Sem Alterações</span>
          <i class="ph-bold ph-check-circle text-lg text-slate-400"></i>
        `;
      }

      // Preenche caixa de comparação
      const diffBox = document.getElementById(`batch-diff-${source.id}`);
      if (diffBox) {
        diffBox.classList.remove('hidden');
        
        let patternHtml = '';
        if (hasPatternDiff) {
          patternHtml = `
            <div>
              <span class="font-bold text-slate-450 dark:text-slate-400">Padrão URL:</span> 
              <span class="line-through text-red-500 dark:text-red-400/70 font-mono">${source.searchUrlPattern || '(Nenhum)'}</span> 
              <i class="ph-bold ph-arrow-right mx-1 text-slate-400"></i>
              <span class="text-emerald-600 dark:text-emerald-400 font-mono font-bold">${analysis.detectedPattern}</span>
            </div>
          `;
        } else {
          patternHtml = `
            <div>
              <span class="font-bold text-slate-450 dark:text-slate-400">Padrão URL:</span> 
              <span class="text-slate-500 dark:text-slate-400 font-mono">${source.searchUrlPattern || '(Sem Alterações)'}</span>
            </div>
          `;
        }

        let descHtml = '';
        if (hasDescriptionDiff) {
          descHtml = `
            <div>
              <span class="font-bold text-slate-450 dark:text-slate-400">Descrição:</span> 
              <span class="line-through text-red-500 dark:text-red-400/70">${source.description || '(Nenhuma)'}</span> 
              <i class="ph-bold ph-arrow-right mx-1 text-slate-400"></i>
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">${analysis.optimizedDescription}</span>
            </div>
          `;
        } else {
          descHtml = `
            <div>
              <span class="font-bold text-slate-450 dark:text-slate-400">Descrição:</span> 
              <span class="text-slate-500 dark:text-slate-400">${source.description || '(Sem Alterações)'}</span>
            </div>
          `;
        }

        diffBox.innerHTML = `
          <div class="space-y-1 mt-1 font-sans">
            ${patternHtml}
            ${descHtml}
            <div class="text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-lg mt-1 border border-slate-200/40 dark:border-slate-800/40 leading-relaxed">
              <strong>Lógica da IA:</strong> ${analysis.explanation}
            </div>
          </div>
        `;
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        if (logBox) logBox.classList.add('hidden');
        break; // Interrompe fila
      }

      rowEl.className = "p-3.5 flex flex-col gap-2 text-xs bg-red-500/5 dark:bg-red-950/10 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150";
      statusContainer.innerHTML = `
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 font-bold mr-1.5" title="${err.message}">Falhou</span>
        <i class="ph-bold ph-warning-circle text-lg text-red-500" title="${err.message}"></i>
      `;
      
      // Exibe erro na caixa de logs
      if (logBox) {
        logBox.classList.remove('hidden');
        logBox.innerHTML += `<div class="text-red-555 dark:text-red-400 font-bold">Erro: ${err.message}</div>`;
      }
    }

    completed++;
    batchProgressText.innerText = `${completed} / ${sortedSources.length} Sites`;
    batchProgressBar.style.width = `${(completed / sortedSources.length) * 100}%`;
  }

  // Finaliza lote
  if (batchEventSource) {
    batchEventSource.close();
    batchEventSource = null;
  }
  
  currentAnalysisSourceId = null;
  currentAnalysisAbortController = null;

  cancelBatchBtn.classList.add('hidden');
  closeBatchBtn.classList.remove('hidden');
  
  await fetchSources();
}

// Cancela o lote e fecha modal
async function cancelBatchAndClose() {
  isBatchCancelled = true;
  if (currentAnalysisSourceId && currentAnalysisAbortController) {
    currentAnalysisAbortController.abort();
    fetch(`/api/sources/${currentAnalysisSourceId}/analyze/cancel`, { method: 'POST' }).catch(() => {});
  }
  if (batchEventSource) {
    batchEventSource.close();
    batchEventSource = null;
  }
  batchAnalysisModal.classList.add('hidden');
  await fetchSources();
}

// --- FUNÇÕES DE GERENCIAMENTO DE PÁGINAS MONITORADAS ---

async function fetchMonitoredPages() {
  if (!monitoredPagesList) return;

  try {
    const res = await fetch('/api/monitored-pages');
    const data = await res.json();

    if (data.success) {
      renderMonitoredPagesList(data.pages || []);
    } else {
      if (typeof showDelugeToast === 'function') showDelugeToast(data.error || 'Erro ao carregar páginas monitoradas', 'error');
    }
  } catch (err) {
    if (typeof showDelugeToast === 'function') showDelugeToast('Erro ao buscar páginas monitoradas: ' + err.message, 'error');
  }
}

function renderMonitoredPagesList(pages) {
  if (!monitoredPagesList) return;
  if (monitoredCountBadge) monitoredCountBadge.innerText = `${pages.length} Página(s)`;

  if (pages.length === 0) {
    monitoredPagesList.innerHTML = `
      <div class="p-8 text-center text-slate-400 dark:text-slate-500">
        <i class="ph-bold ph-desktop-tower text-3xl mb-2 text-emerald-500 opacity-60"></i>
        <h4 class="font-bold text-slate-700 dark:text-slate-350">Nenhuma página sendo monitorada</h4>
        <p class="text-xs max-w-sm mx-auto mt-1">Adicione a URL de páginas de torrents para capturar automaticamente novos episódios ou lançamentos a cada 12h.</p>
      </div>
    `;
    return;
  }

  monitoredPagesList.innerHTML = pages.map(page => {
    const safeTitle = escapeHtml(page.title || 'Página de Torrent');
    const safeUrl = escapeHtml(page.url);

    let lastCheckedText = 'Nunca verificado';
    if (page.lastCheckedAt) {
      const d = new Date(page.lastCheckedAt);
      lastCheckedText = d.toLocaleString('pt-BR');
    }

    let lastChangedText = 'Sem novidades';
    if (page.lastContentChangedAt) {
      const dChange = new Date(page.lastContentChangedAt);
      lastChangedText = dChange.toLocaleString('pt-BR');
    }

    const isMonitored = page.monitor !== false;

    const hasImage = page.imageUrl && typeof page.imageUrl === 'string' && page.imageUrl.trim().length > 5;
    const safeImage = hasImage ? escapeHtml(page.imageUrl) : '';

    const imageHtml = hasImage ? `
      <div class="relative shrink-0">
        <img src="${safeImage}" alt="${safeTitle}" class="w-14 h-20 sm:w-16 sm:h-22 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-800" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'w-14 h-20 sm:w-16 sm:h-22 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400\\'><i class=\\'ph-bold ph-image text-xl\\'></i></div>';" />
      </div>
    ` : `
      <div class="w-14 h-20 sm:w-16 sm:h-22 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
        <i class="ph-bold ph-film-strip text-2xl opacity-60 text-brand-500"></i>
      </div>
    `;

    return `
      <div class="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/40 transition-colors">
        <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          ${imageHtml}
          <div class="space-y-1.5 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 truncate max-w-md" title="${safeTitle}">${safeTitle}</h4>
              <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full ${isMonitored ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">
                ${isMonitored ? 'Ativo (12h)' : 'Pausado'}
              </span>
              <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center gap-1">
                <i class="ph-bold ph-magnet text-[10px]"></i> ${page.torrentsCount || 0} Magnet(s)
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
              <a href="${safeUrl}" target="_blank" class="truncate text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 max-w-md">
                <i class="ph-bold ph-link-simple shrink-0"></i> <span class="truncate">${safeUrl}</span>
              </a>
              <span class="shrink-0">• Novos torrents em: <strong class="text-slate-700 dark:text-slate-300 font-semibold">${lastChangedText}</strong></span>
              <span class="shrink-0">• Checagem: ${lastCheckedText}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <!-- Toggle Monitorar -->
          <label class="relative inline-flex items-center cursor-pointer" title="${isMonitored ? 'Desativar monitoramento automático' : 'Ativar monitoramento automático'}">
            <input type="checkbox" class="sr-only peer" ${isMonitored ? 'checked' : ''} onchange="toggleMonitoredPageStatus(${page.id})" />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
          </label>

          <!-- Botão Verificar Agora -->
          <button onclick="checkMonitoredPageNow(${page.id}, this)" class="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all" title="Verificar novos torrents nesta página agora">
            <i class="ph-bold ph-arrows-counter-clockwise"></i> Verificar Agora
          </button>

          <!-- Botão Excluir -->
          <button onclick="deleteMonitoredPage(${page.id})" class="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-500/20 hover:border-red-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all" title="Excluir página do banco de dados">
            <i class="ph-bold ph-trash"></i> Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleMonitoredPageStatus(id) {
  try {
    const res = await fetch(`/api/monitored-pages/${id}/toggle`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      if (typeof showDelugeToast === 'function') showDelugeToast(`Status de monitoramento alterado com sucesso!`, 'success');
      fetchMonitoredPages();
    } else {
      if (typeof showDelugeToast === 'function') showDelugeToast(data.error || 'Erro ao alterar status', 'error');
    }
  } catch (err) {
    if (typeof showDelugeToast === 'function') showDelugeToast('Erro de conexão: ' + err.message, 'error');
  }
}

async function checkMonitoredPageNow(id, btnEl) {
  const origHtml = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Checando...`;
  }

  try {
    const res = await fetch(`/api/monitored-pages/${id}/check`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      const msg = `Verificação concluída! ${data.addedCount} novo(s) torrent(s) adicionado(s) (${data.existingCount} já existia(m)).`;
      if (typeof showDelugeToast === 'function') showDelugeToast(msg, data.addedCount > 0 ? 'success' : 'warning');
      fetchMonitoredPages();
      if (typeof fetchDelugeTorrents === 'function') fetchDelugeTorrents();
    } else {
      if (typeof showDelugeToast === 'function') showDelugeToast(data.error || 'Erro ao verificar página', 'error');
    }
  } catch (err) {
    if (typeof showDelugeToast === 'function') showDelugeToast('Erro de conexão: ' + err.message, 'error');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = origHtml;
    }
  }
}

async function handleCheckAllMonitoredPages() {
  if (!checkAllMonitoredBtn) return;
  const origHtml = checkAllMonitoredBtn.innerHTML;
  checkAllMonitoredBtn.disabled = true;
  checkAllMonitoredBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Verificando todas...`;

  try {
    const res = await fetch('/api/monitored-pages/check-all', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      if (typeof showDelugeToast === 'function') showDelugeToast(`Todas as páginas foram verificadas! ${data.addedTotal || 0} novo(s) torrent(s) adicionado(s).`, 'success');
      fetchMonitoredPages();
      if (typeof fetchDelugeTorrents === 'function') fetchDelugeTorrents();
    } else {
      if (typeof showDelugeToast === 'function') showDelugeToast(data.error || 'Erro ao verificar páginas monitoradas', 'error');
    }
  } catch (err) {
    if (typeof showDelugeToast === 'function') showDelugeToast('Erro de conexão: ' + err.message, 'error');
  } finally {
    checkAllMonitoredBtn.disabled = false;
    checkAllMonitoredBtn.innerHTML = origHtml;
  }
}

async function deleteMonitoredPage(id) {
  const confirmed = await confirm('Deseja realmente excluir esta página do monitoramento? Ela será removida do banco de dados.', 'Excluir Página');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/monitored-pages/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      if (typeof showDelugeToast === 'function') showDelugeToast('Página removida do monitoramento com sucesso!', 'success');
      fetchMonitoredPages();
    } else {
      if (typeof showDelugeToast === 'function') showDelugeToast(data.error || 'Erro ao excluir página', 'error');
    }
  } catch (err) {
    if (typeof showDelugeToast === 'function') showDelugeToast('Erro de conexão: ' + err.message, 'error');
  }
}
