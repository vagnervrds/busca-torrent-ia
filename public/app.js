// Variáveis Globais de Estado
let searches = [];
let activeSearchId = null;
let activeSearchData = { results: [], logs: [] };
let eventSource = null;
let searchSources = [];

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
const sourcesTableBody = document.getElementById('sourcesTableBody');
const sourceModal = document.getElementById('sourceModal');
const sourceForm = document.getElementById('sourceForm');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

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

  // Event Listeners Gerais
  themeToggleBtn.addEventListener('click', toggleTheme);
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
  closeModalBtn.addEventListener('click', closeSourceModal);
  cancelModalBtn.addEventListener('click', closeSourceModal);

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

    // Badge Ativo/Inativo
    const statusBadge = source.isActive
      ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><i class="ph-fill ph-circle text-[6px] mr-1 inline-block"></i>Ativo</span>`
      : `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20">Inativo</span>`;

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
    return;
  }

  copyAllMagnetsBtn.disabled = false;
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
