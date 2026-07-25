// Format bytes into readable format
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    let myChart = null;
    let selectedItem = null;

    // DOM Elements
    const container = document.getElementById('treemap-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorOverlay = document.getElementById('path-not-found');
    
    const panel = document.getElementById('item-panel');
    const panelName = document.getElementById('item-name');
    const panelPath = document.getElementById('item-path');
    const panelSize = document.getElementById('item-size');
    const panelType = document.getElementById('item-type');
    
    const btnRefresh = document.getElementById('btn-refresh');
    const btnDiscover = document.getElementById('btn-discover');
    const btnDiscoverOverlay = document.getElementById('btn-discover-overlay');
    const btnClosePanel = document.getElementById('close-panel');
    const btnDelete = document.getElementById('btn-delete');

    function initChart() {
        if (!myChart) {
            myChart = echarts.init(container);
            
            myChart.on('click', (params) => {
                // params.data will have the node info
                // However, echarts treemap handles zoom on left click by default.
                // We will hook into it to show our panel.
                if (params.data && params.data.path) {
                    showPanel(params.data);
                }
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                myChart.resize();
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

    async function loadTree() {
        hidePanel();
        loadingOverlay.classList.remove('hidden');
        errorOverlay.classList.add('hidden');
        
        try {
            const res = await fetch('/api/storage/tree');
            if (!res.ok) {
                if (res.status === 400) {
                    // Path not discovered
                    loadingOverlay.classList.add('hidden');
                    errorOverlay.classList.remove('hidden');
                    return;
                }
                throw new Error('Erro ao carregar dados do servidor');
            }
            
            const rawData = await res.json();
            renderTreemap(rawData);
            loadingOverlay.classList.add('hidden');
        } catch (err) {
            alert('Falha ao carregar armazenamento: ' + err.message);
            loadingOverlay.classList.add('hidden');
        }
    }

    function renderTreemap(data) {
        initChart();
        
        // Echarts Treemap requires data array
        const chartData = [data];

        const option = {
            tooltip: {
                formatter: function (info) {
                    var value = info.value;
                    var treePathInfo = info.treePathInfo;
                    var treePath = [];
                    for (var i = 1; i < treePathInfo.length; i++) {
                        treePath.push(treePathInfo[i].name);
                    }
                    return [
                        '<div class="tooltip-title">' + echarts.format.encodeHTML(treePath.join('/')) + '</div>',
                        'Tamanho: ' + formatSize(value)
                    ].join('');
                }
            },
            series: [
                {
                    name: 'Armazenamento',
                    type: 'treemap',
                    visibleMin: 300,
                    label: {
                        show: true,
                        formatter: '{b}'
                    },
                    upperLabel: {
                        show: true,
                        height: 30
                    },
                    itemStyle: {
                        borderColor: '#0f111a',
                        borderWidth: 2,
                        gapWidth: 1
                    },
                    levels: [
                        {
                            itemStyle: {
                                borderColor: '#777',
                                borderWidth: 0,
                                gapWidth: 1
                            },
                            upperLabel: {
                                show: false
                            }
                        },
                        {
                            itemStyle: {
                                borderColor: '#555',
                                borderWidth: 5,
                                gapWidth: 1
                            },
                            emphasis: {
                                itemStyle: {
                                    borderColor: '#ddd'
                                }
                            }
                        },
                        {
                            colorSaturation: [0.35, 0.5],
                            itemStyle: {
                                borderWidth: 5,
                                gapWidth: 1,
                                borderColorSaturation: 0.6
                            }
                        }
                    ],
                    data: chartData,
                    // Vibrant colors
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
                // Discovered, reload tree
                loadingOverlay.querySelector('#loading-text').textContent = "Analisando armazenamento no servidor...";
                await loadTree();
            } else {
                alert('Erro ao descobrir caminho: ' + result.error);
                loadingOverlay.classList.add('hidden');
                errorOverlay.classList.remove('hidden');
            }
        } catch (err) {
            alert('Falha na comunicação com servidor: ' + err.message);
            loadingOverlay.classList.add('hidden');
            errorOverlay.classList.remove('hidden');
        }
    }

    async function deleteSelectedItem() {
        if (!selectedItem) return;
        
        const confirmMsg = `ATENÇÃO!
        
Você tem certeza que deseja apagar DEFINITIVAMENTE:
${selectedItem.path}

Esta ação não pode ser desfeita.`;

        if (!confirm(confirmMsg)) return;

        btnDelete.disabled = true;
        btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Apagando...';

        try {
            const res = await fetch('/api/storage/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: selectedItem.path })
            });

            const result = await res.json();
            if (result.success) {
                hidePanel();
                await loadTree();
            } else {
                alert('Erro ao apagar: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (err) {
            alert('Falha ao comunicar com servidor: ' + err.message);
        } finally {
            btnDelete.disabled = false;
            btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> Apagar Definitivamente';
        }
    }

    // Events
    btnRefresh.addEventListener('click', loadTree);
    btnDiscover.addEventListener('click', discoverPath);
    btnDiscoverOverlay.addEventListener('click', discoverPath);
    btnClosePanel.addEventListener('click', hidePanel);
    btnDelete.addEventListener('click', deleteSelectedItem);

    // Initial load
    loadTree();
});
