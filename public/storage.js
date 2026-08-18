// Format bytes into readable format (e.g. 1.25 GB)
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
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

  setupCustomDialogs();

  let myChart = null;
  let selectedItem = null;
  let activeView = 'manager'; // 'manager' or 'blocks'
  
  // State for Navigation and Selection
  let treeData = null;
  let currentFolderNode = null;
  let navigationHistory = [];
  let selectedPaths = new Set();
  let currentDeletionTarget = null; // Holds item or items array to delete

  // DOM Elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const errorOverlay = document.getElementById('path-not-found');
  
  // Views
  const fileManagerView = document.getElementById('file-manager-view');
  const treemapView = document.getElementById('treemap-view');
  const treemapContainer = document.getElementById('treemap-container');
  
  // Buttons & Controls
  const btnViewManager = document.getElementById('btn-view-manager');
  const btnViewBlocks = document.getElementById('btn-view-blocks');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnDiscover = document.getElementById('btn-discover');
  const btnDiscoverOverlay = document.getElementById('btn-discover-overlay');
  
  // File Navigation Elements
  const btnGoBack = document.getElementById('btn-go-back');
  const breadcrumbsContainer = document.getElementById('breadcrumbs-container');
  const fileListBody = document.getElementById('file-list-body');

  // Batch delete controls
  const btnDeleteSelected = document.getElementById('btn-delete-selected');
  const selectedCountSpan = document.getElementById('selected-count');
  const checkboxSelectAll = document.getElementById('checkbox-select-all');

  // Search & Recursive Filter Elements
  const fileSearchInput = document.getElementById('file-search-input');
  const checkboxRecursiveSearch = document.getElementById('checkbox-recursive-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const searchCountBadge = document.getElementById('search-count-badge');


  // Custom Deletion Confirmation Modal
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteModalList = document.getElementById('delete-modal-list');
  const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
  const btnDeleteCancel = document.getElementById('btn-delete-cancel');
  const deleteProgressContainer = document.getElementById('delete-progress-container');
  const deleteProgressStatus = document.getElementById('delete-progress-status');
  const deleteProgressText = document.getElementById('delete-progress-text');
  const deleteProgressBar = document.getElementById('delete-progress-bar');
  
  // Disk space elements
  const diskThunterText = document.getElementById('disk-thunter-text');
  const diskOthersText = document.getElementById('disk-others-text');
  const diskFreeText = document.getElementById('disk-free-text');
  const diskTotalText = document.getElementById('disk-total-text');
  const barThunter = document.getElementById('bar-thunter');
  const barOthers = document.getElementById('bar-others');
  const barFree = document.getElementById('bar-free');

  // ECharts Selected Item Panel
  const panel = document.getElementById('item-panel');
  const panelName = document.getElementById('item-name');
  const panelPath = document.getElementById('item-path');
  const panelSize = document.getElementById('item-size');
  const panelType = document.getElementById('item-type');
  const btnClosePanel = document.getElementById('close-panel');
  const btnDelete = document.getElementById('btn-delete');

  function initChart() {
    if (!myChart && activeView === 'blocks') {
      myChart = echarts.init(treemapContainer);
      
      myChart.on('click', (params) => {
        if (params.data && params.data.path) {
          showPanel(params.data);
        }
      });

      // Handle window resize
      window.addEventListener('resize', () => {
        if (myChart) myChart.resize();
        setupMarqueeOverflowCheck();
      });
    }
  }

  function showPanel(data) {
    selectedItem = data;
    panelName.textContent = data.name;
    panelPath.textContent = data.path;
    panelSize.textContent = formatSize(data.value);
    panelType.textContent = data.children ? 'Pasta' : 'Arquivo';
    
    panel.classList.remove('hidden');
  }

  function hidePanel() {
    panel.classList.add('hidden');
    selectedItem = null;
  }

  // Find node in the tree recursively by path
  function findNodeByPath(node, targetPath) {
    if (!node) return null;
    if (node.path === targetPath) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeByPath(child, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  // Rebuild navigation history stack up to a target node
  function rebuildHistoryToNode(targetNode) {
    navigationHistory = [];
    let cur = treeData;
    while (cur && cur.path !== targetNode.path) {
      navigationHistory.push(cur);
      if (cur.children) {
        cur = cur.children.find(child => targetNode.path.startsWith(child.path) || child.path === targetNode.path);
      } else {
        cur = null;
      }
    }
  }

  // Render Disk Space Bar
  function renderDiskSpace(diskInfo, thunterSize) {
    if (!diskInfo) {
      diskThunterText.textContent = formatSize(thunterSize);
      diskOthersText.textContent = 'Indisponível';
      diskFreeText.textContent = 'Indisponível';
      diskTotalText.textContent = 'Indisponível';
      barThunter.style.width = '100%';
      barOthers.style.width = '0%';
      barFree.style.width = '0%';
      return;
    }

    const total = diskInfo.total;
    const free = diskInfo.free;
    const used = diskInfo.used;
    
    // T-Hunter downloads size
    const thunter = thunterSize;
    // Others space = Used drive space minus T-Hunter downloads size
    let others = used - thunter;
    if (others < 0) others = 0;

    // Percentages
    const pctThunter = (thunter / total) * 100;
    const pctOthers = (others / total) * 100;
    const pctFree = (free / total) * 100;

    // Update texts
    diskThunterText.textContent = `${formatSize(thunter)} (${pctThunter.toFixed(1)}%)`;
    diskOthersText.textContent = `${formatSize(others)} (${pctOthers.toFixed(1)}%)`;
    diskFreeText.textContent = `${formatSize(free)} (${pctFree.toFixed(1)}%)`;
    diskTotalText.textContent = formatSize(total);

    // Update bar sizes
    barThunter.style.width = `${pctThunter}%`;
    barOthers.style.width = `${pctOthers}%`;
    barFree.style.width = `${pctFree}%`;
  }

  // Render Breadcrumbs dynamically
  function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = '';
    if (!currentFolderNode || !treeData) return;

    const pathStr = currentFolderNode.path;
    const parts = pathStr.split(/[/\\]/).filter(Boolean);
    const isWindows = pathStr.includes(':');

    // Add root directory breadcrumb
    const rootBtn = document.createElement('button');
    rootBtn.className = "text-slate-400 hover:text-brand-500 font-bold transition-colors focus:outline-none flex items-center gap-1";
    rootBtn.innerHTML = `<i class="ph-fill ph-hard-drive"></i> Downloads`;
    rootBtn.addEventListener('click', () => {
      navigationHistory = [];
      currentFolderNode = treeData;
      renderCurrentFolder();
    });
    breadcrumbsContainer.appendChild(rootBtn);

    // Add nested breadcrumbs
    parts.forEach((part, index) => {
      const sep = document.createElement('span');
      sep.className = "text-slate-400 dark:text-slate-700 px-1 font-normal";
      sep.textContent = "/";
      breadcrumbsContainer.appendChild(sep);

      const link = document.createElement('button');
      link.className = "text-slate-500 hover:text-brand-500 font-bold transition-colors max-w-[120px] truncate align-middle focus:outline-none";
      link.textContent = part;

      // Reconstruct absolute path up to this breadcrumb part
      let searchPath = '';
      if (isWindows) {
        if (parts[0].includes(':') && index === 0) {
          searchPath = parts[0] + '\\';
        } else {
          searchPath = parts.slice(0, index + 1).join('\\');
        }
      } else {
        searchPath = '/' + parts.slice(0, index + 1).join('/');
      }

      link.addEventListener('click', () => {
        const targetNode = findNodeByPath(treeData, searchPath);
        if (targetNode) {
          rebuildHistoryToNode(targetNode);
          currentFolderNode = targetNode;
          renderCurrentFolder();
        }
      });

      breadcrumbsContainer.appendChild(link);
    });
  }

  // Update Batch Delete Button & Count
  function updateBatchDeleteState() {
    const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
    selectedPaths.clear();
    checkedBoxes.forEach(chk => {
      selectedPaths.add(chk.dataset.path);
    });

    const count = selectedPaths.size;
    selectedCountSpan.textContent = count;
    
    if (count > 0) {
      btnDeleteSelected.classList.remove('hidden');
    } else {
      btnDeleteSelected.classList.add('hidden');
    }

    // Update Select All Checkbox state
    const allBoxes = document.querySelectorAll('.item-checkbox');
    if (allBoxes.length > 0 && checkedBoxes.length === allBoxes.length) {
      checkboxSelectAll.checked = true;
      checkboxSelectAll.indeterminate = false;
    } else if (checkedBoxes.length > 0) {
      checkboxSelectAll.checked = false;
      checkboxSelectAll.indeterminate = true;
    } else {
      checkboxSelectAll.checked = false;
      checkboxSelectAll.indeterminate = false;
    }
  }

  // Helper for recursive search in subfolders
  function collectMatchingDescendants(node, query, results = []) {
    if (!node || !node.children) return results;
    for (const child of node.children) {
      if (child.name.toLowerCase().includes(query)) {
        results.push(child);
      }
      if (child.children) {
        collectMatchingDescendants(child, query, results);
      }
    }
    return results;
  }

  // Render file manager navigator table rows
  function renderCurrentFolder() {
    fileListBody.innerHTML = '';
    if (!currentFolderNode) return;

    renderBreadcrumbs();

    // Reset selection state when entering a folder / searching
    checkboxSelectAll.checked = false;
    checkboxSelectAll.indeterminate = false;
    selectedPaths.clear();
    btnDeleteSelected.classList.add('hidden');

    // Show/hide Go Back button
    if (navigationHistory.length > 0) {
      btnGoBack.classList.remove('hidden');
    } else {
      btnGoBack.classList.add('hidden');
    }

    const searchTerm = fileSearchInput ? fileSearchInput.value.trim() : '';
    const isRecursive = checkboxRecursiveSearch ? checkboxRecursiveSearch.checked : false;

    // Toggle clear search button visibility
    if (btnClearSearch) {
      if (searchTerm) {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }

    let items = [];
    if (!searchTerm) {
      items = currentFolderNode.children || [];
      if (searchCountBadge) searchCountBadge.classList.add('hidden');
    } else {
      const query = searchTerm.toLowerCase();
      if (isRecursive) {
        items = collectMatchingDescendants(currentFolderNode, query);
      } else {
        items = (currentFolderNode.children || []).filter(item => item.name.toLowerCase().includes(query));
      }
      if (searchCountBadge) {
        searchCountBadge.textContent = `${items.length} encontrado(s)`;
        searchCountBadge.classList.remove('hidden');
      }
    }
    
    if (items.length === 0) {
      if (searchTerm) {
        fileListBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-10 text-slate-400 dark:text-slate-500 text-xs md:text-sm">
              <i class="ph-bold ph-magnifying-glass text-3xl mb-1.5 block opacity-50 text-slate-500"></i>
              Nenhum item encontrado para "<span class="font-bold">${searchTerm.replace(/</g, "&lt;")}</span>"${isRecursive ? ' (busca em subpastas)' : ''}
            </td>
          </tr>`;
      } else {
        fileListBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-10 text-slate-400 dark:text-slate-500 text-xs md:text-sm">
              <i class="ph-bold ph-folder-open text-3xl mb-1.5 block opacity-50 text-slate-500"></i>
              Esta pasta está vazia
            </td>
          </tr>`;
      }
      return;
    }

    // Sort items: folders first, then files, sorted by size descending
    const sorted = [...items].sort((a, b) => {
      const aIsFolder = !!a.children;
      const bIsFolder = !!b.children;
      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }
      return b.value - a.value;
    });

    sorted.forEach(item => {
      const isFolder = !!item.children;
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";

      // Checkbox column
      const tdCheck = document.createElement('td');
      tdCheck.className = "py-3 px-2 sm:px-4 w-8 sm:w-10";
      
      const chk = document.createElement('input');
      chk.type = "checkbox";
      chk.className = "item-checkbox w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 cursor-pointer";
      chk.dataset.path = item.path;
      chk.addEventListener('change', updateBatchDeleteState);
      
      tdCheck.appendChild(chk);
      tr.appendChild(tdCheck);

      const iconHtml = isFolder
        ? '<i class="ph-fill ph-folder text-amber-500 text-lg flex-shrink-0"></i>'
        : '<i class="ph-fill ph-file text-slate-400 dark:text-slate-500 text-lg flex-shrink-0"></i>';

      // Name column
      const tdName = document.createElement('td');
      tdName.className = "py-3 px-2 sm:px-4 font-medium text-xs md:text-sm min-w-0 max-w-[180px] sm:max-w-xs md:max-w-md lg:max-w-xl";
      
      const wrapper = document.createElement('div');
      wrapper.className = "flex items-center gap-2 overflow-hidden min-w-0 w-full";
      
      const nameBtn = document.createElement('button');
      nameBtn.type = "button";
      nameBtn.className = isFolder
        ? "text-left text-slate-800 dark:text-slate-200 hover:text-brand-500 font-semibold focus:outline-none transition-colors flex items-center gap-2 overflow-hidden min-w-0 w-full"
        : "text-left text-slate-650 dark:text-slate-400 font-normal pointer-events-none flex items-center gap-2 overflow-hidden min-w-0 w-full";
      
      const iconSpan = document.createElement('span');
      iconSpan.className = "flex-shrink-0 inline-flex items-center";
      iconSpan.innerHTML = iconHtml;

      const marqueeContainer = document.createElement('div');
      marqueeContainer.className = "name-marquee-container flex-1 overflow-hidden relative align-middle min-w-0";

      const nameSpan = document.createElement('span');
      nameSpan.className = "name-text inline-block whitespace-nowrap";
      nameSpan.textContent = item.name;

      marqueeContainer.appendChild(nameSpan);

      // If recursive search is active and item is from a subfolder, show relative path
      if (searchTerm && isRecursive && item.path && currentFolderNode.path) {
        let relPath = item.path;
        if (relPath.startsWith(currentFolderNode.path)) {
          relPath = relPath.substring(currentFolderNode.path.length).replace(/^[/\\]/, '');
        }
        if (relPath && relPath !== item.name) {
          const subPathSpan = document.createElement('div');
          subPathSpan.className = "text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-full font-normal";
          subPathSpan.textContent = '📁 ' + relPath;
          marqueeContainer.appendChild(subPathSpan);
        }
      }

      nameBtn.appendChild(iconSpan);
      nameBtn.appendChild(marqueeContainer);

      if (isFolder) {
        nameBtn.addEventListener('click', () => {
          navigationHistory.push(currentFolderNode);
          currentFolderNode = item;
          if (fileSearchInput) fileSearchInput.value = '';
          renderCurrentFolder();
        });
      }

      wrapper.appendChild(nameBtn);
      tdName.appendChild(wrapper);
      tr.appendChild(tdName);

      // Size column
      const tdSize = document.createElement('td');
      tdSize.className = "py-3 px-2 sm:px-4 text-right font-semibold text-slate-600 dark:text-slate-400 text-xs md:text-sm whitespace-nowrap w-20 sm:w-28";
      tdSize.textContent = formatSize(item.value);
      tr.appendChild(tdSize);

      // Actions column
      const tdActions = document.createElement('td');
      tdActions.className = "py-3 px-2 sm:px-4 text-right w-12 sm:w-16";
      
      const delBtn = document.createElement('button');
      delBtn.type = "button";
      delBtn.className = "text-red-500 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all focus:outline-none flex items-center justify-center ml-auto";
      delBtn.innerHTML = '<i class="ph-bold ph-trash text-sm md:text-base"></i>';
      delBtn.title = "Apagar definitivamente";

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteConfirm([item]);
      });

      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      fileListBody.appendChild(tr);
    });

    // Check and trigger marquee animation for overflowing text
    requestAnimationFrame(() => {
      setupMarqueeOverflowCheck();
    });
  }

  function setupMarqueeOverflowCheck() {
    const containers = fileListBody.querySelectorAll('.name-marquee-container');
    containers.forEach(container => {
      const span = container.querySelector('.name-text');
      if (span && container) {
        container.classList.remove('is-overflowing');
        const overflowDist = span.scrollWidth - container.clientWidth;
        if (overflowDist > 3) {
          const dist = overflowDist + 20;
          const duration = Math.max(4, Math.round(dist / 22));
          container.style.setProperty('--marquee-dist', `-${dist}px`);
          container.style.setProperty('--marquee-duration', `${duration}s`);
          container.classList.add('is-overflowing');
        }
      }
    });
  }

  async function loadTree() {
    hidePanel();
    
    // 1. Tenta carregar cache instantanéo para SWR no cliente
    const cachedTree = localStorage.getItem('cached_storage_tree');
    const cachedDisk = localStorage.getItem('cached_storage_disk');
    if (cachedTree) {
      try {
        const rawData = JSON.parse(cachedTree);
        treeData = rawData;
        
        if (cachedDisk) {
          const diskData = JSON.parse(cachedDisk);
          renderDiskSpace(diskData, treeData.value);
        } else {
          renderDiskSpace(null, treeData.value);
        }
        
        if (!currentFolderNode) {
          currentFolderNode = treeData;
        } else {
          currentFolderNode = findNodeByPath(treeData, currentFolderNode.path) || treeData;
        }
        
        renderCurrentFolder();
        if (activeView === 'blocks') {
          renderTreemap(treeData);
        }
      } catch (e) {
        console.warn("Erro ao ler cache do localStorage:", e);
      }
    }

    loadingOverlay.querySelector('#loading-text').textContent = "Analisando armazenamento...";
    loadingOverlay.classList.remove('hidden');
    errorOverlay.classList.add('hidden');
    
    try {
      const res = await fetch('/api/storage/tree');
      if (!res.ok) {
        if (res.status === 400) {
          loadingOverlay.classList.add('hidden');
          errorOverlay.classList.remove('hidden');
          return;
        }
        throw new Error('Erro ao carregar dados do servidor');
      }
      
      const payload = await res.json();
      
      // Salva no localStorage para a próxima vez
      localStorage.setItem('cached_storage_tree', JSON.stringify(payload.tree));
      if (payload.disk) {
        localStorage.setItem('cached_storage_disk', JSON.stringify(payload.disk));
      }
      
      treeData = payload.tree;
      
      // Preserva pasta atual se ela ainda existir na nova árvore
      if (!currentFolderNode) {
        currentFolderNode = treeData;
        navigationHistory = [];
      } else {
        const updated = findNodeByPath(treeData, currentFolderNode.path);
        if (updated) {
          currentFolderNode = updated;
          rebuildHistoryToNode(currentFolderNode);
        } else {
          currentFolderNode = treeData;
          navigationHistory = [];
        }
      }
      
      renderDiskSpace(payload.disk, treeData.value);
      renderCurrentFolder();
      
      if (activeView === 'blocks') {
        renderTreemap(treeData);
      }
      loadingOverlay.classList.add('hidden');
    } catch (err) {
      await alert('Falha ao carregar armazenamento: ' + err.message);
      loadingOverlay.classList.add('hidden');
    }
  }

  function renderTreemap(data) {
    initChart();
    if (!myChart) return;
    
    const chartData = [data];

    const option = {
      tooltip: {
        formatter: function (info) {
          const value = info.value;
          const treePathInfo = info.treePathInfo;
          const treePath = [];
          for (let i = 1; i < treePathInfo.length; i++) {
            treePath.push(treePathInfo[i].name);
          }
          return `
            <div class="p-2 text-xs font-sans text-slate-200">
              <div class="font-bold border-b border-slate-700 pb-1 mb-1.5 truncate max-w-xs">${echarts.format.encodeHTML(treePath.join('/'))}</div>
              <div>Tamanho: <span class="font-semibold text-brand-400">${formatSize(value)}</span></div>
            </div>`;
        },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 0
      },
      series: [
        {
          name: 'Armazenamento',
          type: 'treemap',
          visibleMin: 300,
          label: {
            show: true,
            formatter: '{b}',
            fontFamily: 'Inter',
            fontSize: 11
          },
          upperLabel: {
            show: true,
            height: 25,
            color: '#94a3b8',
            fontFamily: 'Inter',
            fontWeight: 'bold',
            fontSize: 10
          },
          itemStyle: {
            borderColor: '#020617',
            borderWidth: 1,
            gapWidth: 1
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#1e293b',
                borderWidth: 0,
                gapWidth: 1
              },
              upperLabel: {
                show: false
              }
            },
            {
              itemStyle: {
                borderColor: '#334155',
                borderWidth: 4,
                gapWidth: 1
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#8b5cf6'
                }
              }
            },
            {
              colorSaturation: [0.35, 0.5],
              itemStyle: {
                borderWidth: 4,
                gapWidth: 1,
                borderColorSaturation: 0.6
              }
            }
          ],
          data: chartData,
          color: ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981']
        }
      ]
    };

    myChart.setOption(option);
  }

  async function discoverPath() {
    loadingOverlay.querySelector('#loading-text').textContent = "Varrendo servidor...";
    loadingOverlay.classList.remove('hidden');
    errorOverlay.classList.add('hidden');
    
    try {
      const res = await fetch('/api/storage/discover-path', { method: 'POST' });
      const result = await res.json();
      
      if (result.success) {
        await loadTree();
      } else {
        await alert('Erro ao descobrir caminho: ' + result.error);
        loadingOverlay.classList.add('hidden');
        errorOverlay.classList.remove('hidden');
      }
    } catch (err) {
      await alert('Falha na comunicação com servidor: ' + err.message);
      loadingOverlay.classList.add('hidden');
      errorOverlay.classList.remove('hidden');
    }
  }

  // Confirmation Modal Deletion Hooks
  function openDeleteConfirm(items) {
    currentDeletionTarget = items;
    deleteModalList.innerHTML = '';
    
    // Reseta estado da barra de progresso e botões
    if (deleteProgressContainer) {
      deleteProgressContainer.classList.add('hidden');
      deleteProgressBar.style.width = '0%';
      deleteProgressText.textContent = '0 / 0 (0%)';
      deleteProgressStatus.textContent = 'Aguardando confirmação...';
    }

    if (btnDeleteConfirm) {
      btnDeleteConfirm.disabled = false;
      btnDeleteConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
      btnDeleteConfirm.innerHTML = 'Confirmar Exclusão';
    }
    if (btnDeleteCancel) {
      btnDeleteCancel.disabled = false;
      btnDeleteCancel.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = "flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0";
      
      const isFolder = item.children !== undefined || item.isFolder;
      const icon = isFolder
        ? '<i class="ph-fill ph-folder text-amber-500 text-base"></i>'
        : '<i class="ph-fill ph-file text-slate-400 text-base"></i>';
        
      div.innerHTML = `${icon} <span class="truncate font-semibold text-slate-700 dark:text-slate-300">${item.name}</span>`;
      deleteModalList.appendChild(div);
    });

    deleteConfirmModal.classList.remove('hidden');
    setTimeout(() => {
      deleteConfirmModal.firstElementChild.classList.remove('scale-95');
      deleteConfirmModal.firstElementChild.classList.add('scale-100');
    }, 10);
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.firstElementChild.classList.remove('scale-100');
    deleteConfirmModal.firstElementChild.classList.add('scale-95');
    setTimeout(() => {
      deleteConfirmModal.classList.add('hidden');
      if (deleteProgressContainer) deleteProgressContainer.classList.add('hidden');
      currentDeletionTarget = null;
    }, 150);
  }

  async function executeDeletion() {
    if (!currentDeletionTarget || currentDeletionTarget.length === 0) return;
    
    const itemsToDelete = [...currentDeletionTarget];
    const total = itemsToDelete.length;

    // Exibe container de progresso e desabilita botões
    if (deleteProgressContainer) {
      deleteProgressContainer.classList.remove('hidden');
      deleteProgressBar.style.width = '0%';
      deleteProgressText.textContent = `0 / ${total} (0%)`;
      deleteProgressStatus.textContent = 'Iniciando exclusão...';
    }

    if (btnDeleteConfirm) {
      btnDeleteConfirm.disabled = true;
      btnDeleteConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      btnDeleteConfirm.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Excluindo...';
    }
    if (btnDeleteCancel) {
      btnDeleteCancel.disabled = true;
      btnDeleteCancel.classList.add('opacity-50', 'cursor-not-allowed');
    }

    hidePanel();

    let successCount = 0;
    let deletedPaths = [];

    for (let i = 0; i < total; i++) {
      const item = itemsToDelete[i];
      const startPercent = Math.round((i / total) * 100);

      if (deleteProgressStatus) {
        deleteProgressStatus.textContent = `Excluindo (${i + 1}/${total}): ${item.name}`;
      }
      if (deleteProgressBar) {
        deleteProgressBar.style.width = `${startPercent}%`;
      }
      if (deleteProgressText) {
        deleteProgressText.textContent = `${i} / ${total} (${startPercent}%)`;
      }

      try {
        const res = await fetch('/api/storage/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [item.path] })
        });

        const result = await res.json();
        if (result.success) {
          successCount++;
          deletedPaths.push(item.path);
        } else {
          console.error(`Erro ao apagar ${item.name}:`, result.error);
        }
      } catch (err) {
        console.error(`Falha ao comunicar com servidor para ${item.name}:`, err);
      }

      const endPercent = Math.round(((i + 1) / total) * 100);
      if (deleteProgressBar) {
        deleteProgressBar.style.width = `${endPercent}%`;
      }
      if (deleteProgressText) {
        deleteProgressText.textContent = `${i + 1} / ${total} (${endPercent}%)`;
      }
    }

    if (deleteProgressStatus) {
      deleteProgressStatus.textContent = `Exclusão concluída (${successCount}/${total})`;
    }

    if (deletedPaths.length > 0) {
      deletedPaths.forEach(p => {
        if (currentFolderNode && currentFolderNode.path === p) {
          if (navigationHistory.length > 0) {
            currentFolderNode = navigationHistory.pop();
          } else {
            currentFolderNode = null;
          }
        }
      });
      await loadTree();
    }

    setTimeout(() => {
      closeDeleteConfirm();
    }, 600);
  }

  // Switch View modes
  function switchView(viewMode) {
    activeView = viewMode;
    hidePanel();

    if (viewMode === 'manager') {
      btnViewManager.className = "py-1.5 px-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold rounded-lg text-xs transition-all shadow-sm flex items-center gap-1.5 focus:outline-none";
      btnViewBlocks.className = "py-1.5 px-3 text-slate-400 dark:text-slate-500 font-semibold rounded-lg text-xs transition-all flex items-center gap-1.5 focus:outline-none";
      
      fileManagerView.classList.remove('hidden');
      treemapView.classList.add('hidden');
    } else {
      btnViewManager.className = "py-1.5 px-3 text-slate-400 dark:text-slate-500 font-semibold rounded-lg text-xs transition-all flex items-center gap-1.5 focus:outline-none";
      btnViewBlocks.className = "py-1.5 px-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold rounded-lg text-xs transition-all shadow-sm flex items-center gap-1.5 focus:outline-none";
      
      fileManagerView.classList.add('hidden');
      treemapView.classList.remove('hidden');
      
      if (treeData) {
        renderTreemap(treeData);
        setTimeout(() => {
          if (myChart) myChart.resize();
        }, 50);
      }
    }
  }

  // Navigation handlers
  btnGoBack.addEventListener('click', () => {
    if (navigationHistory.length > 0) {
      currentFolderNode = navigationHistory.pop();
      renderCurrentFolder();
    }
  });

  // Checkbox Select All click
  checkboxSelectAll.addEventListener('change', () => {
    const isChecked = checkboxSelectAll.checked;
    const checkboxes = document.querySelectorAll('.item-checkbox');
    checkboxes.forEach(chk => {
      chk.checked = isChecked;
    });
    updateBatchDeleteState();
  });

  // Batch delete button click
  btnDeleteSelected.addEventListener('click', () => {
    if (selectedPaths.size === 0) return;
    
    const itemsToDelete = [];
    selectedPaths.forEach(path => {
      const node = findNodeByPath(treeData, path);
      if (node) {
        itemsToDelete.push(node);
      } else {
        const name = path.split(/[/\\]/).pop();
        itemsToDelete.push({ name, path });
      }
    });

    openDeleteConfirm(itemsToDelete);
  });

  // Switch views events
  btnViewManager.addEventListener('click', () => switchView('manager'));
  btnViewBlocks.addEventListener('click', () => switchView('blocks'));

  // Header Actions
  btnRefresh.addEventListener('click', loadTree);
  btnDiscover.addEventListener('click', discoverPath);
  btnDiscoverOverlay.addEventListener('click', discoverPath);
  
  const btnCheckClean = document.getElementById('btn-check-clean-storage');
  if (btnCheckClean) {
    btnCheckClean.addEventListener('click', async () => {
      const originalHtml = btnCheckClean.innerHTML;
      btnCheckClean.disabled = true;
      btnCheckClean.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> Verificando...`;

      try {
        const res = await fetch('/api/storage/check-cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulatedSizeMB: 10 })
        });
        const data = await res.json();

        if (!data.success) {
          await window.alert("Aviso de Armazenamento:\n\n" + (data.error || "Não foi possível verificar o espaço."), "Espaço em Disco");
        } else {
          await window.alert(data.message, "Verificação de Limpeza");
        }

        btnCheckClean.innerHTML = `<i class="ph-bold ph-check text-sm"></i> Concluído!`;
        btnCheckClean.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

        loadTree();

        setTimeout(() => {
          btnCheckClean.disabled = false;
          btnCheckClean.innerHTML = originalHtml;
          btnCheckClean.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
        }, 3000);
      } catch (err) {
        btnCheckClean.disabled = false;
        btnCheckClean.innerHTML = originalHtml;
        await window.alert("Erro ao executar verificação: " + err.message, "Erro");
      }
    });
  }
  
  // ECharts Item Panel Actions
  btnClosePanel.addEventListener('click', hidePanel);
  btnDelete.addEventListener('click', () => {
    if (selectedItem) {
      openDeleteConfirm([selectedItem]);
    }
  });

  // Modal Deletion Actions
  if (btnDeleteConfirm) btnDeleteConfirm.addEventListener('click', executeDeletion);
  if (btnDeleteCancel) btnDeleteCancel.addEventListener('click', closeDeleteConfirm);

  // Search input & recursive filter events
  if (fileSearchInput) {
    fileSearchInput.addEventListener('input', () => renderCurrentFolder());
  }
  if (checkboxRecursiveSearch) {
    checkboxRecursiveSearch.addEventListener('change', () => renderCurrentFolder());
  }
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      fileSearchInput.value = '';
      renderCurrentFolder();
    });
  }

  // Initial load
  loadTree();

});
