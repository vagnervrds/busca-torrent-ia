// Variáveis Globais de Estado

let searches = [];

let activeSearchId = null;

let activeSearchData = { results: [], logs: [] };

let eventSource = null;

let searchSources = [];

let delugeOnline = false;

let delugeEventSource = null;

let delugeRemoveTargetId = null;
let delugeTorrentsCache = {};



// Elementos do DOM

const themeToggleBtn = document.getElementById('themeToggleBtn');

const sidebar = document.getElementById('sidebar');

const searchesList = document.getElementById('searchesList');

const newSearchBtn = document.getElementById('newSearchBtn');

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



// --- INICIALIZAÇÃO ---



document.addEventListener('DOMContentLoaded', () => {

  // Inicialização de Tema Claro/Escuro

  const savedTheme = localStorage.getItem('theme') || 'dark';

  if (savedTheme === 'dark') {

    document.documentElement.classList.add('dark');

  } else {

    document.documentElement.classList.remove('dark');

  }



  // Carrega buscas iniciais

  fetchSearches();

  checkDelugeStatus();



  // Event Listeners Gerais

  themeToggleBtn.addEventListener('click', toggleTheme);

  sidebarDelugeBtn.addEventListener('click', showDelugeSection);

  refreshDelugeBtn.addEventListener('click', fetchDelugeTorrents);

  downloadAllDelugeBtn.addEventListener('click', downloadAllTorrentsInDeluge);
  searchDelugeInput.addEventListener('input', () => renderDelugeTorrents(delugeTorrentsCache));
  clearDelugeErrorsBtn.addEventListener('click', clearDelugeErrors);

  

  closeDelugeRemoveModalBtn.addEventListener('click', closeDelugeRemoveModal);

  delugeRemoveCancelBtn.addEventListener('click', closeDelugeRemoveModal);

  delugeRemoveKeepDataBtn.addEventListener('click', () => confirmRemoveTorrent(false));

  delugeRemoveDeleteDataBtn.addEventListener('click', () => confirmRemoveTorrent(true));

  newSearchBtn.addEventListener('click', showNewSearchForm);

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

  settingsForm.addEventListener('submit', handleSettingsSubmit);

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



  // Botões de Exemplos de Busca

  exampleBtns.forEach(btn => {

    btn.addEventListener('click', () => {

      queryInput.value = btn.innerText.trim();

      queryInput.focus();

    });

  });

});



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

    

    document.getElementById('aiProvider').value = config.aiProvider || 'openai';

    document.getElementById('aiModel').value = config.aiModel || 'gemini-3-flash';

    document.getElementById('aiUrl').value = config.aiUrl || '';

    document.getElementById('aiToken').value = config.aiToken || '';

    document.getElementById('preferredLanguage').value = config.preferredLanguage || 'Português';

    document.getElementById('preferredResolution').value = config.preferredResolution || '1080p';

  } catch (err) {

    console.error("Erro ao carregar configurações:", err);

  }

}



// Salva as configurações gerais

async function handleSettingsSubmit(e) {

  e.preventDefault();

  

  const config = {

    aiProvider: document.getElementById('aiProvider').value,

    aiModel: document.getElementById('aiModel').value.trim(),

    aiUrl: document.getElementById('aiUrl').value.trim(),

    aiToken: document.getElementById('aiToken').value.trim(),

    preferredLanguage: document.getElementById('preferredLanguage').value.trim(),

    preferredResolution: document.getElementById('preferredResolution').value

  };



  try {

    const res = await fetch('/api/settings', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(config)

    });

    

    if (!res.ok) throw new Error("Erro ao gravar dados");

    const data = await res.json();

    alert(data.message || "Configurações gravadas com sucesso.");

  } catch (err) {

    alert("Erro ao salvar: " + err.message);

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



// Renderiza a lista de fontes na tabela do frontend

function renderSourcesTable() {

  if (searchSources.length === 0) {

    sourcesTableBody.innerHTML = `

      <tr>

        <td colspan="5" class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">

          <i class="ph-bold ph-globe text-xl block mb-1 opacity-50"></i>

          Nenhum site cadastrado

        </td>

      </tr>`;

    return;

  }



  sourcesTableBody.innerHTML = searchSources.map(source => {

    // Badges de tipos de conteúdos

    const typeBadges = source.contentTypes.map(t => {

      let label = t;

      let color = 'bg-slate-100 text-slate-655 dark:bg-slate-950 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800';

      if (t === 'series') { label = 'Séries'; color = 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400'; }

      if (t === 'movies') { label = 'Filmes'; color = 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400'; }

      if (t === 'book') { label = 'Livros'; color = 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'; }

      if (t === 'music') { label = 'Músicas'; color = 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'; }

      

      return `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${color}">${label}</span>`;

    }).join(' ');



    const statusBadge = source.isActive
      ? `<span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 whitespace-nowrap"><i class="ph-fill ph-circle text-[6px] mr-1"></i>Ativo</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 whitespace-nowrap"><i class="ph-fill ph-circle text-[6px] mr-1 text-slate-400"></i>Inativo</span>`;



    return `

      <tr class="border-b border-slate-200 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 text-xs">

        <td class="py-4 px-6 font-bold text-slate-700 dark:text-slate-300">

          ${source.name}

          <p class="text-[10px] font-normal text-slate-400 mt-0.5 truncate max-w-xs" title="${source.description}">${source.description || 'Sem descrição.'}</p>

        </td>

        <td class="py-4 px-6 font-mono text-[10px] text-slate-400 max-w-[180px] truncate" title="${source.searchUrlPattern}">

          ${source.url}

        </td>

        <td class="py-4 px-6">

          <div class="flex flex-wrap gap-1">${typeBadges || '<span class="text-slate-500 text-[10px]">Nenhum</span>'}</div>

        </td>

        <td class="py-4 px-6">${statusBadge}</td>

        <td class="py-4 px-6 text-right space-x-1.5">

          <button onclick="analyzeSource(${source.id})" class="p-1.5 btn-ai-analyze rounded-lg transition-colors" title="Otimizar Busca com IA">
            <i class="ph-bold ph-sparkle text-sm"></i>
          </button>

          <button onclick="toggleSourceActive(${source.id})" class="p-1.5 ${source.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'} rounded-lg transition-colors" title="${source.isActive ? 'Desativar Site' : 'Ativar Site'}">
            <i class="ph-bold ${source.isActive ? 'ph-toggle-right' : 'ph-toggle-left'} text-sm"></i>
          </button>

          <button onclick="editSource(${source.id})" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-lg transition-colors" title="Editar">

            <i class="ph-bold ph-pencil-simple text-sm"></i>

          </button>

          <button onclick="deleteSource(${source.id})" class="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Excluir">

            <i class="ph-bold ph-trash text-sm"></i>

          </button>

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

    alert("Falha ao salvar fonte: " + err.message);

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
    alert("Erro: " + err.message);
  }
}

// Exclui uma fonte de busca

async function deleteSource(id) {

  const source = searchSources.find(s => s.id === id);

  if (!source) return;

  

  if (!confirm(`Excluir a fonte de busca "${source.name}"? Isso impedirá o agente de IA de pesquisar nela.`)) return;

  

  try {

    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });

    if (!res.ok) throw new Error("Erro ao excluir fonte");

    

    fetchSources();

  } catch (err) {

    alert("Erro: " + err.message);

  }

}



// Exporta as fontes de busca cadastradas para um arquivo JSON

function exportSources() {

  if (searchSources.length === 0) {

    alert("Nenhuma fonte de busca cadastrada para exportar.");

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

    alert("Erro ao exportar fontes de busca: " + err.message);

  }

}



// Importa fontes de busca a partir de um arquivo JSON

function importSources() {

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

        alert(result.message || "Fontes de busca importadas com sucesso.");

        fetchSources(); // Recarrega do banco

      } catch (err) {

        alert("Erro na importação: " + err.message);

      }

    };

    reader.readAsText(file);

  };

  fileInput.click();

}



// --- BUSCAS E EXECUÇÃO ---



// Busca as pesquisas salvas

async function fetchSearches() {

  try {

    const res = await fetch('/api/searches');

    if (!res.ok) throw new Error("Erro ao carregar histórico");

    searches = await res.json();

    

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

    alert("Falha ao selecionar busca: " + err.message);

  }

}



// Submete a nova busca

async function handleSearchSubmit(e) {

  e.preventDefault();

  const query = queryInput.value.trim();

  if (!query) return;



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

    selectSearch(newSearch.id);

  } catch (err) {

    alert("Erro: " + err.message);

  }

}



// Para a busca ativa

async function stopActiveSearch() {

  if (!activeSearchId) return;

  try {

    const res = await fetch(`/api/searches/${activeSearchId}/stop`, { method: 'POST' });

    if (!res.ok) throw new Error("Falha ao parar busca");

    

    updateActiveSearchStatusUI('stopped');

  } catch (err) {

    alert("Erro: " + err.message);

  }

}



// Reinicia ou retoma a busca

async function restartActiveSearch(resume) {

  if (!activeSearchId) return;

  

  const confirmMsg = resume 

    ? "Deseja retomar a busca de onde parou? (O agente continuará avaliando apenas novos torrents)"

    : "Tem certeza que deseja reiniciar do zero? Todos os resultados e logs desta busca serão apagados.";

    

  if (!confirm(confirmMsg)) return;



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

    alert("Erro: " + err.message);

  }

}



// Exclui busca

async function deleteSearch(id, event) {

  event.stopPropagation();

  

  if (!confirm("Excluir esta busca e todos os seus resultados permanentemente?")) return;

  

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

    alert("Falha ao excluir busca: " + err.message);

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

      <div onclick="selectSearch(${search.id})" class="group cursor-pointer p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${

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

        <button onclick="sendToDeluge('${result.magnetLink}', this)" class="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors mr-1">

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

  }).catch(err => {

    alert("Erro ao copiar para clipboard: " + err.message);

  });

}



function copyAllMagnetLinks() {

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

  }).catch(err => {

    alert("Erro ao copiar magnets: " + err.message);

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
  delugeSection.classList.remove('hidden');
  activeSearchQueryTitle.innerText = "Gerenciador Deluge";
  
  renderSearchesList();
  
  // Inicia SSE para atualização em tempo real
  setupDelugeSSE();
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
    return;
  }

  try {
    const res = await fetch('/api/deluge/torrents');
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erro ao obter torrents");
    }

    delugeTorrentsCache = data.torrents || {};
    renderDelugeTorrents(delugeTorrentsCache);
  } catch (err) {
    console.error("Erro ao buscar torrents:", err);
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

async function sendToDeluge(magnetLink, buttonEl) {

  try {

    const origHtml = buttonEl.innerHTML;

    buttonEl.disabled = true;

    buttonEl.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Enviando...`;

    

    const res = await fetch('/api/deluge/add', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ magnetLink })

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

  

  try {

    const origHtml = downloadAllDelugeBtn.innerHTML;

    downloadAllDelugeBtn.disabled = true;

    downloadAllDelugeBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Adicionando todos...`;

    

    const res = await fetch('/api/deluge/add-multiple', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ magnetLinks: magnets })

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

    alert("Erro ao enviar múltiplos torrents: " + err.message);

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

    alert("Erro ao pausar torrent: " + err.message);

  }

}



async function resumeDelugeTorrent(id) {

  try {

    const res = await fetch(`/api/deluge/torrents/${id}/resume`, { method: 'POST' });

    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    fetchDelugeTorrents();

  } catch (err) {

    alert("Erro ao retomar torrent: " + err.message);

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

    alert("Erro ao remover torrent: " + err.message);

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
    alert("Nenhum torrent com erro foi detectado no momento.");
    return;
  }
  
  const confirmClean = confirm(`Deseja remover todos os ${errorTorrents.length} torrents em estado de erro? Esta ação também excluirá os arquivos no disco e é irreversível.`);
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
      alert(`${data.count} torrent(s) com erro foram removidos com sucesso.`);
      fetchDelugeTorrents();
    } else {
      throw new Error(data.error || "Erro ao apagar torrents");
    }
  } catch (err) {
    alert("Erro ao remover torrents com erro: " + err.message);
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
