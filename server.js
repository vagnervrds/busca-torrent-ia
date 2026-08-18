const express = require('express');
const path = require('path');
const { initDatabase, Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource, CacheEntry, MonitoredPage, sequelize } = require('./database');
const { enqueueSearch, stopSearchAgent, stopAllSearchAgents, testConnection, analyzeSearchSource, cancelSearchSourceAnalysis, analysisEvents } = require('./agent');
const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');
const { DelugeClient } = require('./gerenciar_deluge');

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 4182;

app.use(express.json());

// Estado do Deluge no Servidor
let delugeDisponivel = false;
let delugeCreds = null;
let delugeErro = null;

async function verificarDeluge() {
  try {
    delugeCreds = obterCredenciaisDelugeLocal();
    const port = delugeCreds.delugeWeb.porta;
    const password = delugeCreds.delugeWeb.senhaPadraoDetectada ? 'deluge' : 'deluge';
    
    const client = new DelugeClient(port, password);
    await client.login();
    delugeDisponivel = true;
    delugeErro = null;
    console.log(`[Deluge] Conectado com sucesso ao Deluge local na porta ${port}!`);
  } catch (err) {
    delugeDisponivel = false;
    delugeErro = err.message;
    console.log(`[Deluge] Não disponível localmente ou offline: ${err.message}`);
  }
}

async function getDelugeClient() {
  let port = 8112;
  let password = 'deluge';

  try {
    const creds = obterCredenciaisDelugeLocal();
    port = creds.delugeWeb.porta;
  } catch (e) {
    // Ignorar erro de detecção automática de credenciais
  }

  // Permitir sobrescrever via banco de dados
  try {
    const dbPort = await SystemSetting.findOne({ where: { key: 'delugePort' } });
    const dbPassword = await SystemSetting.findOne({ where: { key: 'delugePassword' } });
    if (dbPort && dbPort.value) port = parseInt(dbPort.value, 10);
    if (dbPassword && dbPassword.value) password = dbPassword.value;
  } catch (e) {
    // Ignorar erros do banco ao obter configurações adicionais
  }

  const client = new DelugeClient(port, password);
  await client.login();
  return client;
}


// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Clean routes for frontend pages
app.get('/storage', (req, res) => {
  console.log(`[Frontend] Acesso à página de armazenamento (WizTree) recebido.`);
  res.sendFile(path.join(__dirname, 'public', 'storage.html'));
});

// Gerenciamento de conexões SSE em tempo real
const sseClients = new Map(); // searchId -> Set de Response
const globalSseClients = new Set(); // Set de Response global

global.sseBroadcast = (searchId, eventData) => {
  const clients = sseClients.get(Number(searchId));
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  
  if (clients) {
    clients.forEach(res => {
      try {
        res.write(payload);
      } catch (err) {
        console.error("Erro ao enviar dados SSE para cliente:", err.message);
      }
    });
  }

  // Envia também para clientes globais (adicionando searchId)
  const globalPayload = `data: ${JSON.stringify({ searchId: Number(searchId), ...eventData })}\n\n`;
  globalSseClients.forEach(res => {
    try {
      res.write(globalPayload);
    } catch (err) {
      // Ignora, tratado no close do request
    }
  });
};

// --- CACHE SWR (Stale-While-Revalidate) ---
// Retorna dado em cache imediatamente (mesmo que velho) e revalida em background.
// Isso garante que o frontend não fica travado esperando queries pesadas no DietPi.
const activeRevalidations = new Set();

async function withSWRCache(key, ttlSeconds, fetchFn) {
  try {
    const cached = await CacheEntry.findByPk(key);
    
    if (cached) {
      const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
      const isStale = ageMs > cached.ttl * 1000;
      
      if (!isStale) {
        // Cache válido: retorna direto sem revalidar
        return JSON.parse(cached.data);
      }
      
      // Cache stale: retorna imediatamente E revalida em background
      const staleData = JSON.parse(cached.data);
      
      // Revalida de forma assíncrona (não bloqueia a resposta) se não houver revalidação ativa
      if (!activeRevalidations.has(key)) {
        activeRevalidations.add(key);
        setImmediate(async () => {
          try {
            const freshData = await fetchFn();
            await CacheEntry.upsert({
              key,
              data: JSON.stringify(freshData),
              cachedAt: new Date(),
              ttl: ttlSeconds
            });
          } catch (e) {
            console.error(`[SWR Cache] Erro ao revalidar "${key}":`, e.message);
          } finally {
            activeRevalidations.delete(key);
          }
        });
      }
      
      return staleData;
    }
  } catch (e) {
    console.error(`[SWR Cache] Erro ao ler cache "${key}":`, e.message);
  }
  
  // Cache miss: busca dado fresco, armazena e retorna
  const freshData = await fetchFn();
  try {
    await CacheEntry.upsert({
      key,
      data: JSON.stringify(freshData),
      cachedAt: new Date(),
      ttl: ttlSeconds
    });
  } catch (e) {
    console.error(`[SWR Cache] Erro ao gravar cache "${key}":`, e.message);
  }
  return freshData;
}

// Invalida uma ou mais entradas do cache SWR
async function invalidateCache(...keys) {
  try {
    const { Op } = require('sequelize');
    // Em vez de destruir, marca como expirado (stale) alterando a data para 1970
    // Isso garante que o cache antigo continue sendo entregue instantaneamente
    // enquanto a revalidação ocorre em segundo plano (SWR puro).
    await CacheEntry.update(
      { cachedAt: new Date(0) },
      { where: { key: { [Op.in]: keys } } }
    );
  } catch (e) {
    // Não é crítico se falhar
  }
}

// --- ROTAS DA API ---

// 1. Configurações Globais (GET e POST)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await SystemSetting.findAll();
    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });

    if (!config.deluge_download_path) {
      const discoveredPath = await discoverDelugePath();
      if (discoveredPath) {
        config.deluge_download_path = discoveredPath;
      }
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const config = req.body;
    for (const key of Object.keys(config)) {
      await SystemSetting.upsert({
        key: key,
        value: String(config[key])
      });
    }
    res.json({ success: true, message: 'Configurações salvas com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/test', async (req, res) => {
  try {
    const config = req.body;
    const result = await testConnection(config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/restart', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'shutdown /r /t 5 /f' : 'sudo shutdown -r +1';
    
    console.log(`Reinício do sistema operacional solicitado pelo usuário. Executando: ${command}`);
    
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`Erro ao executar comando de reinício: ${stderr || err.message}`);
        return res.status(500).json({ success: false, error: stderr || err.message });
      }
      res.json({ success: true, message: 'O sistema operacional está sendo reiniciado...' });
    });
  } catch (err) {
    console.error('Erro ao processar reinício do servidor:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/shutdown', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'shutdown /s /t 5 /f' : 'sudo shutdown -h +1';
    
    console.log(`Desligamento do sistema operacional solicitado pelo usuário. Executando: ${command}`);
    
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`Erro ao executar comando de desligamento: ${stderr || err.message}`);
        return res.status(500).json({ success: false, error: stderr || err.message });
      }
      res.json({ success: true, message: 'O sistema operacional está sendo desligado...' });
    });
  } catch (err) {
    console.error('Erro ao processar desligamento do servidor:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// 2. Fontes de Busca - CRUD

// Listar todas
app.get('/api/sources', async (req, res) => {
  try {
    const sources = await SearchSource.findAll({
      order: [['id', 'ASC']]
    });
    
    // Converte os contentTypes de volta de string JSON para array nas respostas
    const formatted = sources.map(s => {
      const json = s.toJSON();
      try {
        json.contentTypes = JSON.parse(s.contentTypes);
      } catch (e) {
        json.contentTypes = [];
      }
      return json;
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar nova
app.post('/api/sources', async (req, res) => {
  try {
    const { name, url, searchUrlPattern, description, contentTypes, isActive } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL base é obrigatória.' });
    }

    let finalName = name ? name.trim() : '';
    if (!finalName) {
      try {
        finalName = new URL(url).hostname;
      } catch (e) {
        finalName = 'Nova Fonte';
      }
    }

    let finalPattern = searchUrlPattern ? searchUrlPattern.trim() : '';
    if (!finalPattern) {
      const base = url.endsWith('/') ? url : url + '/';
      finalPattern = `${base}?q={query}`;
    }
    
    const source = await SearchSource.create({
      name: finalName,
      url: url.trim(),
      searchUrlPattern: finalPattern,
      description: description ? description.trim() : '',
      contentTypes: JSON.stringify(contentTypes || []),
      isActive: isActive !== false
    });
    
    const resJson = source.toJSON();
    resJson.contentTypes = contentTypes || [];
    
    res.status(201).json(resJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar existente
app.put('/api/sources/:id', async (req, res) => {
  try {
    const sourceId = Number(req.params.id);
    const { name, url, searchUrlPattern, description, contentTypes, isActive } = req.body;
    
    const source = await SearchSource.findByPk(sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Fonte de busca não encontrada.' });
    }

    let finalUrl = url !== undefined ? url.trim() : source.url;

    let finalName = name !== undefined ? name.trim() : source.name;
    if (!finalName && finalUrl) {
      try {
        finalName = new URL(finalUrl).hostname;
      } catch (e) {
        finalName = 'Nova Fonte';
      }
    }

    let finalPattern = searchUrlPattern !== undefined ? searchUrlPattern.trim() : source.searchUrlPattern;
    if (!finalPattern && finalUrl) {
      const base = finalUrl.endsWith('/') ? finalUrl : finalUrl + '/';
      finalPattern = `${base}?q={query}`;
    }
    
    await source.update({
      name: finalName,
      url: finalUrl,
      searchUrlPattern: finalPattern,
      description: description !== undefined ? description.trim() : source.description,
      contentTypes: contentTypes !== undefined ? JSON.stringify(contentTypes) : source.contentTypes,
      isActive: isActive !== undefined ? isActive : source.isActive
    });
    
    const resJson = source.toJSON();
    try {
      resJson.contentTypes = JSON.parse(source.contentTypes);
    } catch(e) {
      resJson.contentTypes = [];
    }
    
    res.json(resJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar
app.delete('/api/sources/:id', async (req, res) => {
  try {
    const sourceId = Number(req.params.id);
    const source = await SearchSource.findByPk(sourceId);
    
    if (!source) {
      return res.status(404).json({ error: 'Fonte de busca não encontrada.' });
    }
    
    await source.destroy();
    res.json({ success: true, message: 'Fonte de busca removida com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analisar estratégia de busca de URL temporária/rascunho com IA
app.post('/api/sources/analyze-url', async (req, res) => {
  const { url, name } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL base é obrigatória.' });
  }

  // Cria um objeto temporário simulando a estrutura do SearchSource
  const tempSource = {
    id: -1, // ID especial para novos temporários
    name: name || new URL(url).hostname || 'Nova Fonte',
    url: url,
    searchUrlPattern: url, // Padrão inicial temporário
    description: '',
    contentTypes: '[]',
    isActive: true
  };

  try {
    const result = await analyzeSearchSource(tempSource);
    if (!result.success) {
      return res.status(400).json({ error: result.error, isConnectionError: result.isConnectionError });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancelar análise temporária
app.post('/api/sources/analyze-url/cancel', async (req, res) => {
  try {
    const result = await cancelSearchSourceAnalysis(-1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analisar estratégia de busca com IA
app.post('/api/sources/:id/analyze', async (req, res) => {
  const sourceId = Number(req.params.id);
  
  // Cancela análise se o cliente desconectar (ex: cancelou fetch no frontend)
  const onClose = () => {
    cancelSearchSourceAnalysis(sourceId).catch(() => {});
  };
  req.on('close', onClose);

  try {
    const result = await analyzeSearchSource(sourceId);
    req.off('close', onClose);
    if (!result.success) {
      return res.status(400).json({ error: result.error, isConnectionError: result.isConnectionError });
    }
    res.json(result);
  } catch (err) {
    req.off('close', onClose);
    res.status(500).json({ error: err.message });
  }
});

// Cancelar análise de estratégia de busca
app.post('/api/sources/:id/analyze/cancel', async (req, res) => {
  try {
    const sourceId = Number(req.params.id);
    const result = await cancelSearchSourceAnalysis(sourceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota SSE para streaming de logs de análise em tempo real
app.get('/api/sources/analyze/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  
  const onLog = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  analysisEvents.on('log', onLog);
  
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);
  
  req.on('close', () => {
    clearInterval(pingInterval);
    analysisEvents.off('log', onLog);
  });
});

// Importar fontes de busca em lote
app.post('/api/sources/import', async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Os dados de importação devem ser um array de fontes.' });
    }
    
    let importedCount = 0;
    for (const item of items) {
      const { name, url, searchUrlPattern, description, contentTypes, isActive } = item;
      if (!name || !url || !searchUrlPattern) {
        continue;
      }
      
      const existing = await SearchSource.findOne({
        where: {
          [Op.or]: [
            { url: url.trim() },
            { name: name.trim() }
          ]
        }
      });
      
      const formattedContentTypes = Array.isArray(contentTypes) 
        ? JSON.stringify(contentTypes) 
        : (typeof contentTypes === 'string' ? contentTypes : '[]');
        
      if (existing) {
        await existing.update({
          name: name.trim(),
          url: url.trim(),
          searchUrlPattern: searchUrlPattern.trim(),
          description: description ? description.trim() : existing.description,
          contentTypes: formattedContentTypes,
          isActive: isActive !== false
        });
      } else {
        await SearchSource.create({
          name: name.trim(),
          url: url.trim(),
          searchUrlPattern: searchUrlPattern.trim(),
          description: description ? description.trim() : '',
          contentTypes: formattedContentTypes,
          isActive: isActive !== false
        });
      }
      importedCount++;
    }
    
    res.json({ success: true, message: `${importedCount} fontes de busca importadas/atualizadas com sucesso.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Iniciar nova busca
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'A consulta de busca é obrigatória.' });
  }

  try {
    const search = await Search.create({
      query: query.trim(),
      status: 'pending'
    });

    // Inicia o agente em segundo plano assincronamente via fila
    enqueueSearch(search.id, false);

    res.status(201).json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.5 Parar todas as buscas
app.post('/api/searches/stop-all', async (req, res) => {
  try {
    await stopAllSearchAgents();
    await invalidateCache('searches_list');
    res.json({ success: true, message: 'Todas as buscas ativas e pendentes foram interrompidas e navegadores fechados.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.6 Reiniciar todas as buscas não concluídas de forma sequencial
app.post('/api/searches/restart-all', async (req, res) => {
  try {
    const { Op } = require('sequelize');

    // Encontra todas as buscas não concluídas
    const searchesToResume = await Search.findAll({
      where: {
        status: { [Op.ne]: 'completed' }
      },
      order: [['id', 'DESC']]
    });

    if (searchesToResume.length > 0) {
      for (const search of searchesToResume) {
        // Altera o status para pending se estava parado/falhado
        if (search.status !== 'pending') {
          search.status = 'pending';
          await search.save();
          
          if (global.sseBroadcast) {
            global.sseBroadcast(search.id, { type: 'status_change', data: { status: 'pending' } });
          }
        }
        enqueueSearch(search.id, true);
      }
    }

    await invalidateCache('searches_list');
    res.json({ 
      success: true, 
      message: `Enfileiradas ${searchesToResume.length} buscas para reinicialização sequencial.`,
      count: searchesToResume.length 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Parar busca ativa
app.post('/api/searches/:id/stop', async (req, res) => {
  const searchId = Number(req.params.id);
  try {
    await stopSearchAgent(searchId);
    // Invalida o cache para forçar refresh imediato do status
    await invalidateCache(`search_detail_${searchId}`, 'searches_list');
    res.json({ success: true, message: 'Solicitação de parada enviada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Retomar ou Reiniciar busca
app.post('/api/searches/:id/restart', async (req, res) => {
  const searchId = Number(req.params.id);
  const { resume } = req.body;

  try {
    const search = await Search.findByPk(searchId);
    if (!search) {
      return res.status(404).json({ error: 'Busca não encontrada.' });
    }

    if (!resume) {
      await AgentLog.destroy({ where: { searchId } });
      await TorrentEvaluation.destroy({ where: { searchId } });
      search.type = 'unknown';
      search.episodesCount = 'unknown';
      search.cost = 0.0;
    }

    search.status = 'pending';
    await search.save();

    global.sseBroadcast(searchId, { type: 'restart', data: { resume } });

    // Invalida o cache para forçar refresh imediato do novo status
    await invalidateCache(`search_detail_${searchId}`, 'searches_list');

    // Inicia o agente em segundo plano assincronamente via fila
    enqueueSearch(searchId, resume);

    res.json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Listar todas as buscas
app.get('/api/searches', async (req, res) => {
  try {
    const { q } = req.query;
    const { Op } = require('sequelize');
    
    const where = {};
    if (q && q.trim()) {
      where.query = {
        [Op.like]: `%${q.trim()}%`
      };
    }
    
    // Chave de cache: inclui o filtro de query para não misturar resultados filtrados
    const cacheKey = `searches_list${q ? '_q_' + q.trim() : ''}`;
    
    const data = await withSWRCache(cacheKey, 15, async () => {
      const searches = await Search.findAll({
        where,
        order: [['updatedAt', 'DESC']]
      });
      
      const searchIds = searches.map(s => s.id);
      let countsMap = {};
      
      if (searchIds.length > 0) {
        const counts = await TorrentResult.findAll({
          attributes: ['searchId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          where: { searchId: searchIds },
          group: ['searchId']
        });
        counts.forEach(c => {
          countsMap[c.searchId] = parseInt(c.get('count') || 0, 10);
        });
      }
      
      const searchesWithStats = searches.map(search => ({
        ...search.toJSON(),
        resultsCount: countsMap[search.id] || 0
      }));
      
      return searchesWithStats;
    });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Obter detalhes, resultados e logs de uma busca
app.get('/api/searches/:id', async (req, res) => {
  const searchId = Number(req.params.id);
  try {
    const data = await withSWRCache(`search_detail_${searchId}`, 10, async () => {
      const search = await Search.findByPk(searchId, {
        include: [
          { model: TorrentResult, as: 'results' },
          { model: AgentLog, as: 'logs', order: [['createdAt', 'ASC']] }
        ]
      });
      if (!search) return null;
      return search.toJSON();
    });

    if (!data) {
      return res.status(404).json({ error: 'Busca não encontrada.' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Excluir uma busca
app.delete('/api/searches/:id', async (req, res) => {
  const searchId = Number(req.params.id);
  try {
    await stopSearchAgent(searchId);
    
    await AgentLog.destroy({ where: { searchId } });
    const deleted = await Search.destroy({ where: { id: searchId } });
    if (!deleted) {
      return res.status(404).json({ error: 'Busca não encontrada.' });
    }
    
    // Invalida o cache desta busca e a lista geral
    await invalidateCache(`search_detail_${searchId}`, 'searches_list');
    
    res.json({ success: true, message: 'Busca excluída com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Endpoint SSE para streaming em tempo real
app.get('/api/searches/:id/stream', (req, res) => {
  const searchId = Number(req.params.id);
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  
  if (!sseClients.has(searchId)) {
    sseClients.set(searchId, new Set());
  }
  sseClients.get(searchId).add(res);
  
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);
  
  req.on('close', () => {
    clearInterval(pingInterval);
    const clients = sseClients.get(searchId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(searchId);
      }
    }
  });
});

// 9.5 Endpoint SSE Global para atualizações em tempo real do histórico
app.get('/api/sse/global', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  
  globalSseClients.add(res);
  
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);
  
  req.on('close', () => {
    clearInterval(pingInterval);
    globalSseClients.delete(res);
  });
});


// --- 10. ROTAS DO DELUGE ---

// Retorna o status de conexão com o Deluge
app.get('/api/deluge/status', async (req, res) => {
  try {
    const data = await withSWRCache('deluge_status', 10, async () => {
      await verificarDeluge();
      return {
        disponivel: delugeDisponivel,
        port: delugeCreds ? delugeCreds.delugeWeb.porta : null,
        error: delugeErro
      };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todos os torrents e seus status no Deluge
app.get('/api/deluge/torrents', async (req, res) => {
  try {
    const data = await withSWRCache('deluge_torrents', 5, async () => {
      const client = await getDelugeClient();
      const torrents = await client.getStatus();
      return { success: true, torrents };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota SSE para streaming de status e lista de torrents do Deluge em tempo real
app.get('/api/deluge/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let isSending = false;

  const sendUpdate = async () => {
    if (isSending) return;
    isSending = true;

    try {
      const statusData = await withSWRCache('deluge_status', 10, async () => {
        await verificarDeluge();
        return {
          disponivel: delugeDisponivel,
          port: delugeCreds ? delugeCreds.delugeWeb.porta : null,
          error: delugeErro
        };
      });

      const torrentsData = await withSWRCache('deluge_torrents', 5, async () => {
        try {
          const client = await getDelugeClient();
          const torrents = await client.getStatus();
          return { success: true, torrents };
        } catch (err) {
          return { success: false, error: err.message };
        }
      });

      res.write(`data: ${JSON.stringify({ 
        disponivel: statusData.disponivel, 
        port: statusData.port, 
        torrents: torrentsData.success ? torrentsData.torrents : {} 
      })}\n\n`);
    } catch (e) {
      // Ignora erros ao fechar conexão
    } finally {
      isSending = false;
    }
  };

  // Envia atualização inicial imediatamente
  await sendUpdate();

  // Envia atualizações a cada 3 segundos
  const intervalId = setInterval(sendUpdate, 3000);

  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

// Adiciona um torrent via magnet link individual
app.post('/api/deluge/add', async (req, res) => {
  const { magnetLink, size } = req.body;
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link é obrigatório.' });
  }
  try {
    const spaceCheck = await ensureDiskSpaceForTorrent(size || magnetLink);
    if (!spaceCheck.success) {
      return res.status(400).json({ success: false, error: spaceCheck.error });
    }

    const client = await getDelugeClient();
    const torrentId = await client.addMagnet(magnetLink);
    await invalidateCache('deluge_torrents');
    res.json({ success: true, torrentId });
  } catch (err) {
    // Torrent já existe na sessão — não é um erro real
    if (err.message && err.message.includes('already in session')) {
      return res.json({ success: true, alreadyExists: true });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});


// Adiciona múltiplos torrents simultaneamente
app.post('/api/deluge/add-multiple', async (req, res) => {
  const { magnetLinks, items, sizes } = req.body;
  if (!magnetLinks || !Array.isArray(magnetLinks)) {
    return res.status(400).json({ error: 'Lista de magnet links é obrigatória.' });
  }
  try {
    const client = await getDelugeClient();
    const results = [];
    for (let i = 0; i < magnetLinks.length; i++) {
      const magnet = magnetLinks[i];
      const itemSize = (items && items[i] && items[i].size) || (sizes && sizes[i]) || magnet;
      try {
        const spaceCheck = await ensureDiskSpaceForTorrent(itemSize);
        if (!spaceCheck.success) {
          results.push({ magnetLink: magnet, success: false, error: spaceCheck.error });
          continue;
        }
        const torrentId = await client.addMagnet(magnet);
        results.push({ magnetLink: magnet, success: true, torrentId });
      } catch (err) {
        // Torrent já existe na sessão — não é um erro real
        if (err.message && err.message.includes('already in session')) {
          results.push({ magnetLink: magnet, success: true, alreadyExists: true });
        } else {
          results.push({ magnetLink: magnet, success: false, error: err.message });
        }
      }
    }
    await invalidateCache('deluge_torrents');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper para extrair a imagem destaque (capa/poster) de um HTML de página web
function extractFeaturedImage(html, pageUrl) {
  if (!html || typeof html !== 'string') return null;

  // 1. Tags Meta (Open Graph & Twitter Card & image_src)
  const ogMatch = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                  html.match(/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
  
  let imageUrl = ogMatch ? ogMatch[1] : null;

  // 2. Fallback: procurar por imagens de post/capa no HTML
  if (!imageUrl) {
    const containerMatch = html.match(/<(div|article|figure)\s+[^>]*(class|id)=["'][^"']*(capa|poster|post|entry|cover)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
    const searchScope = containerMatch ? containerMatch[0] : html;

    const imgMatches = searchScope.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi);
    if (imgMatches) {
      for (const tag of imgMatches) {
        const srcMatch = tag.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const src = srcMatch[1].trim();
          if (!src.includes('logo') && !src.includes('avatar') && !src.includes('icon') && !src.includes('banner') && !src.endsWith('.svg') && src.length > 5) {
            imageUrl = src;
            break;
          }
        }
      }
    }
  }

  if (!imageUrl) return null;

  // 3. Normaliza a URL para absoluta
  try {
    imageUrl = imageUrl.replace(/&amp;/g, '&').trim();
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/') && pageUrl) {
      const parsedPage = new URL(pageUrl);
      imageUrl = `${parsedPage.protocol}//${parsedPage.host}${imageUrl}`;
    } else if (pageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = new URL(imageUrl, pageUrl).href;
    }
    return imageUrl;
  } catch (e) {
    return imageUrl;
  }
}

// Helper para extrair o título da página HTML (<title> ou <h1>)
function extractPageTitle(html) {
  if (!html) return '';
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (titleMatch && titleMatch[1]) {
    let clean = titleMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    clean = clean.replace(/\s*[-|–—]\s*(comando|torrent|baixe|download|pirate).*$/i, '').trim();
    return clean;
  }
  return '';
}

// Helper para extrair o título amigável de um magnet link ou tag <a> do HTML
function extractMagnetTitle(magnet, linkText = '', pageTitle = '') {
  // 1. Tenta extrair do parâmetro dn= no magnet link
  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      const decoded = decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded && decoded.length > 3 && !/^(download|magnet|torrent)$/i.test(decoded)) {
        return decoded;
      }
    }
  } catch (e) {}

  // 2. Tenta extrair o texto limpo da tag <a> do HTML
  let cleanLinkText = '';
  if (linkText) {
    cleanLinkText = linkText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
  }

  const isGeneric = !cleanLinkText || /^(download|magnet|baixar|download torrent|magnet link|clique aqui|link|torrent|opção \d+|baixar torrent)$/i.test(cleanLinkText);

  if (pageTitle) {
    if (!isGeneric && cleanLinkText.length > 1 && !pageTitle.toLowerCase().includes(cleanLinkText.toLowerCase())) {
      return `${pageTitle} - ${cleanLinkText}`;
    }
    return pageTitle;
  }

  if (!isGeneric && cleanLinkText.length > 2) {
    return cleanLinkText;
  }

  // 3. Fallback: hash BTIH
  try {
    const xtMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (xtMatch && xtMatch[1]) {
      return `Torrent (${xtMatch[1].substring(0, 10)})`;
    }
  } catch (e) {}

  return 'Torrent Sem Título';
}

// Extrai TODOS os magnet links e títulos de uma string HTML ou texto
function extractAllTorrentsFromHtml(htmlOrText) {
  const resultsMap = new Map(); // magnet -> title
  if (!htmlOrText) return resultsMap;

  const pageTitle = extractPageTitle(htmlOrText);

  // Decodifica entidades HTML e URL-encoded magnets (magnet%3A%3F -> magnet:?)
  let decoded = htmlOrText
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  decoded = decoded.replace(/magnet%3A%3F/gi, 'magnet:?');

  let optionCounter = 1;

  // 1. Regex ampla para capturar tags <a> contendo magnet links (suporta multilinha com [\s\S]*?)
  const aTagRegex = /<a\s+[^>]*href=["']?([^"' >]*magnet:\?xt=urn:[^"' >]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = aTagRegex.exec(decoded)) !== null) {
    const fullUrl = match[1];
    const linkText = match[2];

    const innerMagnetMatch = fullUrl.match(/magnet:\?xt=urn:[^\s"'<>]+/i);
    if (innerMagnetMatch) {
      let mag = innerMagnetMatch[0];
      try { mag = decodeURIComponent(mag); } catch (e) {}
      mag = mag.trim();

      if (!resultsMap.has(mag)) {
        let title = extractMagnetTitle(mag, linkText, pageTitle);
        const existingTitles = Array.from(resultsMap.values());
        if (existingTitles.includes(title)) {
          title = `${title} (Opção ${optionCounter})`;
        }
        optionCounter++;
        resultsMap.set(mag, title);
      }
    }
  }

  // 2. Captura qualquer outro magnet link solto no texto/HTML
  const globalMagnetRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;
  let standaloneMatch;
  while ((standaloneMatch = globalMagnetRegex.exec(decoded)) !== null) {
    let mag = standaloneMatch[0];
    try { mag = decodeURIComponent(mag); } catch (e) {}
    mag = mag.trim();

    if (!resultsMap.has(mag)) {
      let title = extractMagnetTitle(mag, '', pageTitle);
      const existingTitles = Array.from(resultsMap.values());
      if (existingTitles.includes(title)) {
        title = `${title} (Opção ${optionCounter})`;
      }
      optionCounter++;
      resultsMap.set(mag, title);
    }
  }

  return resultsMap;
}

// Helper para normalizar URLs e evitar duplicadas no banco
function normalizePageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    let normalized = `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    if (normalized.length > 10 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    if (parsed.search) normalized += parsed.search;
    return normalized;
  } catch (e) {
    return trimmed.endsWith('/') && trimmed.length > 10 ? trimmed.slice(0, -1) : trimmed;
  }
}

// Adiciona torrents via Magnet Link direto ou extraindo TODOS os Magnet Links com Títulos de uma URL de página web
app.post('/api/deluge/add-url', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'Magnet Link ou URL é obrigatório.' });
  }

  const inputStr = url.trim();

  try {
    const magnetsFoundMap = new Map(); // magnet -> title

    // 1. Tenta extrair magnet links do próprio texto informado
    const directTorrents = extractAllTorrentsFromHtml(inputStr);
    directTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));

    // 2. Se for uma URL (http:// ou https://), busca o HTML da página via Fetch HTTP
    if (inputStr.startsWith('http://') || inputStr.startsWith('https://')) {
      try {
        const response = await fetch(inputStr, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow'
        });

        if (response.ok) {
          const html = await response.text();
          const pageTorrents = extractAllTorrentsFromHtml(html);
          pageTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
        }
      } catch (fetchErr) {
        console.error('Erro ao acessar a URL via fetch:', fetchErr.message);
      }

      // 3. Se nenhum magnet link foi encontrado via Fetch simples (ex: renderização por JS / protetores de link), usa Puppeteer como fallback
      if (magnetsFoundMap.size === 0) {
        try {
          const puppeteer = require('puppeteer-extra');
          const StealthPlugin = require('puppeteer-extra-plugin-stealth');
          puppeteer.use(StealthPlugin());

          const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.goto(inputStr, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 2000));
          const renderedHtml = await page.content();
          await browser.close();

          const pupTorrents = extractAllTorrentsFromHtml(renderedHtml);
          pupTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
        } catch (pupErr) {
          console.error('Erro ao usar Puppeteer como fallback para extrair magnets:', pupErr.message);
        }
      }
    }

    if (magnetsFoundMap.size === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum Magnet Link foi encontrado na URL ou texto fornecido.'
      });
    }

    const client = await getDelugeClient();
    const results = [];

    for (const [mag, title] of magnetsFoundMap.entries()) {
      try {
        const spaceCheck = await ensureDiskSpaceForTorrent(mag);
        if (!spaceCheck.success) {
          results.push({ title, magnet: mag, success: false, error: spaceCheck.error });
          continue;
        }
        const torrentId = await client.addMagnet(mag);
        results.push({ title, magnet: mag, success: true, torrentId, alreadyExists: false });
      } catch (addErr) {
        if (addErr.message && addErr.message.includes('already in session')) {
          results.push({ title, magnet: mag, success: true, alreadyExists: true });
        } else {
          results.push({ title, magnet: mag, success: false, error: addErr.message });
        }
      }
    }

    const addedCount = results.filter(r => r.success && !r.alreadyExists).length;
    const existingCount = results.filter(r => r.alreadyExists).length;

    // Se o parâmetro monitor for true e for uma URL de página web, salva/atualiza sem duplicar
    if (req.body.monitor !== false && (inputStr.startsWith('http://') || inputStr.startsWith('https://'))) {
      try {
        const normUrl = normalizePageUrl(inputStr);
        let cleanTitle = 'Página de Torrent';
        if (magnetsFoundMap.size > 0) {
          const firstTitle = Array.from(magnetsFoundMap.values())[0];
          if (firstTitle) cleanTitle = firstTitle.split(' - ')[0] || firstTitle;
        }

        const existing = await MonitoredPage.findOne({ where: { url: normUrl } });
        let htmlToExtractImg = null;
        if (typeof html !== 'undefined') htmlToExtractImg = html;
        else if (typeof renderedHtml !== 'undefined') htmlToExtractImg = renderedHtml;

        const featuredImg = htmlToExtractImg ? extractFeaturedImage(htmlToExtractImg, normUrl) : null;

        if (existing) {
          existing.monitor = true;
          if (cleanTitle && cleanTitle !== 'Página de Torrent') existing.title = cleanTitle;
          if (featuredImg) existing.imageUrl = featuredImg;
          if (addedCount > 0 || (magnetsFoundMap.size > 0 && magnetsFoundMap.size !== existing.torrentsCount)) {
            existing.torrentsCount = magnetsFoundMap.size;
            existing.lastContentChangedAt = new Date();
          }
          existing.lastCheckedAt = new Date();
          await existing.save();
        } else {
          await MonitoredPage.create({
            url: normUrl,
            title: cleanTitle,
            imageUrl: featuredImg,
            monitor: true,
            torrentsCount: magnetsFoundMap.size,
            lastContentChangedAt: magnetsFoundMap.size > 0 ? new Date() : null,
            lastCheckedAt: new Date()
          });
        }
      } catch (mErr) {
        console.error('Erro ao salvar página para monitoramento:', mErr.message);
      }
    }

    await invalidateCache('deluge_torrents');

    const failedCount = results.filter(r => !r.success).length;

    return res.json({
      success: true,
      totalFound: magnetsFoundMap.size,
      addedCount,
      existingCount,
      failedCount,
      results
    });
  } catch (err) {
    console.error('Erro em /api/deluge/add-url:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// ENDPOINTS PARA PÁGINAS MONITORADAS (URLs)
// ==========================================

// Listar todas as páginas monitoradas (ordenadas por recência de adição de torrents / data de alteração de conteúdo)
app.get('/api/monitored-pages', async (req, res) => {
  try {
    const pages = await MonitoredPage.findAll({
      order: [
        [sequelize.fn('COALESCE', sequelize.col('lastContentChangedAt'), sequelize.col('createdAt')), 'DESC'],
        ['id', 'DESC']
      ]
    });
    res.json({ success: true, pages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Adicionar nova página para monitorar manualmente (com prevenção de duplicadas)
app.post('/api/monitored-pages', async (req, res) => {
  const { url, title, monitor } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }
  try {
    const normUrl = normalizePageUrl(url);
    const existing = await MonitoredPage.findOne({ where: { url: normUrl } });
    let page;
    if (existing) {
      existing.monitor = monitor !== false;
      if (title) existing.title = title;
      await existing.save();
      page = existing;
    } else {
      page = await MonitoredPage.create({
        url: normUrl,
        title: title || 'Página de Torrent',
        monitor: monitor !== false,
        lastCheckedAt: new Date()
      });
    }
    res.json({ success: true, page, isDuplicate: !!existing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alternar status de monitoramento (Toggle True/False)
app.put('/api/monitored-pages/:id/toggle', async (req, res) => {
  try {
    const page = await MonitoredPage.findByPk(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada.' });
    }
    page.monitor = !page.monitor;
    await page.save();
    res.json({ success: true, page });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Executar verificação manual imediata de 1 página
app.post('/api/monitored-pages/:id/check', async (req, res) => {
  try {
    const page = await MonitoredPage.findByPk(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada.' });
    }

    const magnetsFoundMap = new Map();
    try {
      const response = await fetch(page.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });
      if (response.ok) {
        const html = await response.text();
        const pageTorrents = extractAllTorrentsFromHtml(html);
        pageTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
        const pTitle = extractPageTitle(html);
        if (pTitle) page.title = pTitle;
      }
    } catch (fErr) {}

    if (magnetsFoundMap.size === 0) {
      try {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const pPage = await browser.newPage();
        await pPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await pPage.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        const renderedHtml = await pPage.content();
        await browser.close();

        const pupTorrents = extractAllTorrentsFromHtml(renderedHtml);
        pupTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
        const pTitle = extractPageTitle(renderedHtml);
        if (pTitle) page.title = pTitle;
      } catch (pErr) {}
    }

    const client = await getDelugeClient().catch(() => null);
    let addedCount = 0;
    let existingCount = 0;

    if (client && magnetsFoundMap.size > 0) {
      for (const [mag] of magnetsFoundMap.entries()) {
        try {
          const spaceCheck = await ensureDiskSpaceForTorrent(mag);
          if (!spaceCheck.success) continue;
          await client.addMagnet(mag);
          addedCount++;
        } catch (addErr) {
          if (addErr.message && addErr.message.includes('already in session')) {
            existingCount++;
          }
        }
      }
    }

    page.lastCheckedAt = new Date();
    await page.save();
    await invalidateCache('deluge_torrents');

    res.json({
      success: true,
      page,
      totalFound: magnetsFoundMap.size,
      addedCount,
      existingCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Executar verificação manual imediata de TODAS as páginas ativas
app.post('/api/monitored-pages/check-all', async (req, res) => {
  try {
    const result = await checkMonitoredPagesTask();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Excluir página monitorada (apaga do banco de dados)
app.delete('/api/monitored-pages/:id', async (req, res) => {
  try {
    const page = await MonitoredPage.findByPk(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada.' });
    }
    await page.destroy();
    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Pausa um torrent específico
app.post('/api/deluge/torrents/:id/pause', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await getDelugeClient();
    await client.pause(id);
    await invalidateCache('deluge_torrents');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retoma um torrent pausado específico
app.post('/api/deluge/torrents/:id/resume', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await getDelugeClient();
    await client.resume(id);
    await invalidateCache('deluge_torrents');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove um torrent específico (com opção de apagar dados do disco)
app.post('/api/deluge/torrents/:id/remove', async (req, res) => {
  const { id } = req.params;
  const { removeData } = req.body;
  try {
    const client = await getDelugeClient();
    const success = await client.remove(id, removeData === true);
    await invalidateCache('deluge_torrents', 'storage_tree');
    res.json({ success: true, removed: success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove todos os torrents com erro (com opção de apagar dados do disco)
app.post('/api/deluge/torrents/remove-errors', async (req, res) => {
  const { removeData = true } = req.body;
  try {
    const client = await getDelugeClient();
    const torrents = await client.getStatus();
    const ids = Object.keys(torrents);
    const errorIds = ids.filter(id => torrents[id].state === 'Error');
    
    if (errorIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    
    const promises = errorIds.map(id => client.remove(id, removeData === true));
    await Promise.all(promises);
    
    await invalidateCache('deluge_torrents', 'storage_tree');
    res.json({ success: true, count: errorIds.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// --- 11. ROTAS DO ARMAZENAMENTO (WIZTREE STYLE) ---

const fs = require('fs');

async function discoverDelugePath() {
  try {
    const existing = await SystemSetting.findOne({ where: { key: 'deluge_download_path' } });
    if (existing && existing.value) {
      console.log(`[Storage] Caminho do Deluge já conhecido: ${existing.value}`);
      return existing.value;
    }

    console.log('[Storage] Descobrindo caminho do Deluge via API...');
    
    try {
      const client = await getDelugeClient();
      const config = await client.getConfig();
      if (config && config.download_location) {
        const foundPath = config.download_location;
        await SystemSetting.upsert({ key: 'deluge_download_path', value: foundPath });
        console.log(`[Storage] Caminho do Deluge descoberto e salvo via API: ${foundPath}`);
        return foundPath;
      }
    } catch (apiErr) {
      console.warn('[Storage] Falha ao descobrir via API do Deluge:', apiErr.message);
    }

    console.log('[Storage] Tentando fallback via leitura de arquivo...');
    let configStr = '';
    const configPaths = [
      '/var/lib/deluged/config/core.conf',
      '/var/lib/deluge/.config/deluge/core.conf',
      path.join(require('os').homedir(), '.config/deluge/core.conf')
    ];
    
    for (const p of configPaths) {
      try {
        configStr = fs.readFileSync(p, 'utf8');
        break;
      } catch (e) {}
    }

    if (configStr) {
      let download_location = configStr.match(/"download_location"\s*:\s*"([^"]+)"/);
      if (download_location) {
        let foundPath = download_location[1];
        await SystemSetting.upsert({ key: 'deluge_download_path', value: foundPath });
        console.log(`[Storage] Caminho do Deluge descoberto e salvo via Arquivo: ${foundPath}`);
        return foundPath;
      }
    }
    
    console.log('[Storage] Não foi possível descobrir o caminho do Deluge.');
    return null;
  } catch (err) {
    console.error('[Storage] Erro ao descobrir caminho do Deluge:', err.message);
    return null;
  }
}

app.post('/api/storage/discover-path', async (req, res) => {
  const pathStr = await discoverDelugePath();
  if (pathStr) {
    res.json({ success: true, path: pathStr });
  } else {
    res.status(500).json({ success: false, error: 'Não foi possível encontrar o caminho do Deluge' });
  }
});

async function getDiskSpace(dirPath) {
  const os = require('os');
  const isWin = os.platform() === 'win32';
  
  try {
    if (isWin) {
      let drive = 'C:';
      const match = dirPath.match(/^([a-zA-Z]:)/);
      if (match) {
        drive = match[1];
      }
      
      const cmd = `powershell -Command "Get-PSDrive -Name '${drive[0]}' | Select-Object Used, Free"`;
      const { stdout } = await execPromise(cmd);
      
      const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length >= 3) {
        const parts = lines[2].split(/\s+/).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const used = parts[0];
          const free = parts[1];
          const total = used + free;
          return { total, free, used };
        }
      }
      
      const wmicCmd = `wmic logicaldisk where DeviceID="${drive}" get FreeSpace,Size`;
      const { stdout: wmicOut } = await execPromise(wmicCmd);
      const wmicLines = wmicOut.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (wmicLines.length >= 2) {
        const parts = wmicLines[1].split(/\s+/).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const free = parts[0];
          const total = parts[1];
          const used = total - free;
          return { total, free, used };
        }
      }
    } else {
      const { stdout } = await execPromise(`df -B1 "${dirPath}"`);
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          const total = parseInt(parts[1], 10);
          const used = parseInt(parts[2], 10);
          const free = parseInt(parts[3], 10);
          if (!isNaN(total) && !isNaN(used) && !isNaN(free)) {
            return { total, free, used };
          }
        }
      }
    }
  } catch (err) {
    console.error('[Storage] Erro ao obter espaço em disco:', err.message);
  }
  
  return null;
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function parseSizeBytes(sizeInput) {
  if (!sizeInput) return 0;
  if (typeof sizeInput === 'number') return sizeInput;

  const str = String(sizeInput).trim();

  // Se for um magnet link com parâmetro xl=
  const xlMatch = str.match(/[?&]xl=(\d+)/i);
  if (xlMatch) {
    return parseInt(xlMatch[1], 10);
  }

  // Se for apenas dígitos
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Converte string formatada como "1.5 GB", "700.5 MB", "4.2 GiB", "850 KB"
  const match = str.match(/^([\d.,]+)\s*([a-zA-Z]+)?$/);
  if (match) {
    const numStr = match[1].replace(',', '.');
    const num = parseFloat(numStr);
    if (isNaN(num)) return 0;
    
    const unit = (match[2] || 'B').toUpperCase();
    if (unit.startsWith('TB') || unit.startsWith('TIB')) return Math.round(num * 1024 * 1024 * 1024 * 1024);
    if (unit.startsWith('GB') || unit.startsWith('GIB')) return Math.round(num * 1024 * 1024 * 1024);
    if (unit.startsWith('MB') || unit.startsWith('MIB')) return Math.round(num * 1024 * 1024);
    if (unit.startsWith('KB') || unit.startsWith('KIB')) return Math.round(num * 1024);
    if (unit.startsWith('B')) return Math.round(num);
  }

  return 0;
}

// Helper para gravar logs de armazenamento no arquivo storage_cleanup.log e no console
function writeStorageLog(message) {
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR');
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(`[StorageLog] ${message}`);
  try {
    const logFilePath = path.join(__dirname, 'storage_cleanup.log');
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (err) {
    console.error('[StorageLog] Erro ao gravar no arquivo de log:', err.message);
  }
}

async function ensureDiskSpaceForTorrent(torrentSizeInBytes) {
  const parsed = parseSizeBytes(torrentSizeInBytes);
  const size = (parsed && parsed > 0) ? parsed : 0;

  // Consulta limite mínimo de espaço livre em disco a ser mantido na unidade (padrão 4GB)
  const minSetting = await SystemSetting.findOne({ where: { key: 'minFreeSpaceGB' } });
  const minFreeGB = minSetting ? (parseFloat(minSetting.value) || 4) : 4;
  const minFreeBytes = Math.round(minFreeGB * 1024 * 1024 * 1024);

  // Tamanho necessário = (tamanho do torrent + 10%) + espaço mínimo livre reservado no disco
  const requiredSpace = Math.ceil(size * 1.10) + minFreeBytes;

  const downloadPath = await discoverDelugePath();
  if (!downloadPath || !fs.existsSync(downloadPath)) {
    return { success: true, freed: 0 };
  }

  let diskSpace = await getDiskSpace(downloadPath);
  if (!diskSpace || typeof diskSpace.free !== 'number') {
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(downloadPath);
        const free = Number(stats.bavail || stats.bfree) * Number(stats.bsize);
        diskSpace = { free };
      }
    } catch (e) {}
  }

  if (!diskSpace || typeof diskSpace.free !== 'number') {
    return { success: true, freed: 0 };
  }

  if (diskSpace.free >= requiredSpace) {
    return { success: true, freed: 0 };
  }

  const setting = await SystemSetting.findOne({ where: { key: 'autoDeleteOldFiles' } });
  const autoDeleteEnabled = setting ? (setting.value === 'true' || setting.value === '1') : true;

  if (!autoDeleteEnabled) {
    const errorMsg = `Espaço em disco insuficiente. Necessário: ${formatBytes(requiredSpace)} (${size > 0 ? formatBytes(size) + ' + 10% + ' : ''}${minFreeGB} GB livres a manter), Disponível: ${formatBytes(diskSpace.free)}. A exclusão automática de arquivos antigos está desativada nas configurações.`;
    writeStorageLog(`[Alerta] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg
    };
  }

  writeStorageLog(`[Storage] Espaço em disco insuficiente (${formatBytes(diskSpace.free)} livre / ${formatBytes(requiredSpace)} necessário com reserva de ${minFreeGB} GB). Iniciando remoção automática dos arquivos mais antigos...`);

  function getItemStats(dir) {
    const items = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          let itemSize = stat.size;
          let mtimeMs = stat.mtimeMs;

          if (entry.isDirectory()) {
            itemSize = getFolderSize(fullPath);
          }

          items.push({
            path: fullPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            mtimeMs: mtimeMs,
            size: itemSize
          });
        } catch (stErr) {}
      }
    } catch (rdErr) {
      console.error(`[Storage] Erro ao ler diretório de downloads (${dir}):`, rdErr.message);
    }
    return items;
  }

  function getFolderSize(dir) {
    let folderSize = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            folderSize += getFolderSize(fullPath);
          } else {
            const stat = fs.statSync(fullPath);
            folderSize += stat.size;
          }
        } catch (e) {}
      }
    } catch (e) {}
    return folderSize;
  }

  let items = getItemStats(downloadPath);
  items.sort((a, b) => a.mtimeMs - b.mtimeMs);

  let freedBytes = 0;
  let currentFree = diskSpace.free;

  for (const item of items) {
    if (currentFree >= requiredSpace) {
      break;
    }

    try {
      writeStorageLog(`[Storage] Apagando item antigo: ${item.name} (${formatBytes(item.size)}, modificado em ${new Date(item.mtimeMs).toLocaleString('pt-BR')})`);
      fs.rmSync(item.path, { recursive: true, force: true });
      freedBytes += item.size;
      currentFree += item.size;

      const updatedDisk = await getDiskSpace(downloadPath);
      if (updatedDisk && typeof updatedDisk.free === 'number') {
        currentFree = updatedDisk.free;
      }
    } catch (rmErr) {
      writeStorageLog(`[Storage] Erro ao apagar ${item.path}: ${rmErr.message}`);
    }
  }

  if (freedBytes > 0) {
    await invalidateCache('storage_tree');
    writeStorageLog(`[Storage] Limpeza executada com sucesso! Total liberado: ${formatBytes(freedBytes)}. Espaço livre atual: ${formatBytes(currentFree)}.`);
  }

  if (currentFree < requiredSpace) {
    const failMsg = `Espaço em disco insuficiente mesmo após apagar arquivos antigos. Necessário: ${formatBytes(requiredSpace)}, Disponível após limpeza: ${formatBytes(currentFree)}.`;
    writeStorageLog(`[Erro] ${failMsg}`);
    return {
      success: false,
      error: failMsg
    };
  }

  return { success: true, freed: freedBytes };
}

// Rota para verificar e executar limpeza de disco simulando download (ex: 10 MB)
app.post('/api/storage/check-cleanup', async (req, res) => {
  try {
    const { simulatedSizeMB } = req.body || {};
    const sizeMB = typeof simulatedSizeMB === 'number' && simulatedSizeMB > 0 ? simulatedSizeMB : 10;
    const simulatedSizeInBytes = Math.round(sizeMB * 1024 * 1024);

    writeStorageLog(`[Manual] Verificação de limpeza acionada via botão (simulando torrent de ${sizeMB} MB)...`);
    const result = await ensureDiskSpaceForTorrent(simulatedSizeInBytes);

    const downloadPath = await discoverDelugePath();
    const diskSpace = downloadPath ? await getDiskSpace(downloadPath) : null;

    const minSetting = await SystemSetting.findOne({ where: { key: 'minFreeSpaceGB' } });
    const minFreeGB = minSetting ? (parseFloat(minSetting.value) || 4) : 4;

    if (!result.success) {
      writeStorageLog(`[Manual] Verificação concluída com aviso: ${result.error}`);
      return res.json({
        success: false,
        error: result.error,
        freed: result.freed || 0,
        freedFormatted: formatBytes(result.freed || 0),
        minFreeGB,
        diskSpace
      });
    }

    const logMsg = result.freed > 0
      ? `Verificação concluída! ${formatBytes(result.freed)} de arquivos antigos foram removidos para manter os ${minFreeGB} GB de espaço livre.`
      : `Verificação concluída! O espaço livre atual (${diskSpace ? formatBytes(diskSpace.free) : 'N/A'}) já atende ao limite mínimo configurado (${minFreeGB} GB + ${sizeMB} MB de margem). Nenhuma exclusão foi necessária.`;

    writeStorageLog(`[Manual] ${logMsg}`);

    res.json({
      success: true,
      freed: result.freed || 0,
      freedFormatted: formatBytes(result.freed || 0),
      minFreeGB,
      currentFreeFormatted: diskSpace ? formatBytes(diskSpace.free) : 'N/A',
      message: logMsg
    });
  } catch (err) {
    writeStorageLog(`[Manual] Erro na rota /api/storage/check-cleanup: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para ler os logs do arquivo de limpeza
app.get('/api/storage/logs', async (req, res) => {
  try {
    const logFilePath = path.join(__dirname, 'storage_cleanup.log');
    if (!fs.existsSync(logFilePath)) {
      return res.json({ success: true, logs: 'Nenhum log gravado ainda.' });
    }
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.trim().split('\n').slice(-100).join('\n');
    res.json({ success: true, logs: lines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Função de verificação de armazenamento executada na inicialização do servidor
async function runStartupStorageCheck() {
  writeStorageLog('-----------------------------------------------------------');
  writeStorageLog('[Startup] Executando verificação automática de armazenamento na inicialização da aplicação...');
  try {
    const simulatedSizeInBytes = 10 * 1024 * 1024; // 10 MB
    const result = await ensureDiskSpaceForTorrent(simulatedSizeInBytes);

    const downloadPath = await discoverDelugePath();
    const diskSpace = downloadPath ? await getDiskSpace(downloadPath) : null;
    const minSetting = await SystemSetting.findOne({ where: { key: 'minFreeSpaceGB' } });
    const minFreeGB = minSetting ? (parseFloat(minSetting.value) || 4) : 4;

    if (!result.success) {
      writeStorageLog(`[Startup] Alerta na verificação inicial de armazenamento: ${result.error}`);
    } else if (result.freed > 0) {
      writeStorageLog(`[Startup] Limpeza de inicialização concluída! ${formatBytes(result.freed)} liberados de arquivos antigos. Espaço livre atual: ${diskSpace ? formatBytes(diskSpace.free) : 'N/A'} (Cota mínima: ${minFreeGB} GB).`);
    } else {
      writeStorageLog(`[Startup] Verificação de inicialização concluída. O espaço livre atual (${diskSpace ? formatBytes(diskSpace.free) : 'N/A'}) já atende à cota mínima configurada (${minFreeGB} GB). Nenhuma exclusão necessária.`);
    }
  } catch (err) {
    writeStorageLog(`[Startup] Erro ao executar verificação de armazenamento na inicialização: ${err.message}`);
  }
  writeStorageLog('-----------------------------------------------------------');
}

// Rota para obter rapidamente o espaço em disco (Total, Livre, Usado) da unidade monitorada pelo Deluge
app.get('/api/storage/disk-info', async (req, res) => {
  try {
    const downloadPath = await discoverDelugePath();
    if (!downloadPath || !fs.existsSync(downloadPath)) {
      return res.status(400).json({ success: false, error: 'Caminho do Deluge não encontrado.' });
    }
    const disk = await getDiskSpace(downloadPath);
    if (!disk) {
      return res.status(500).json({ success: false, error: 'Não foi possível obter espaço em disco.' });
    }
    res.json({
      success: true,
      total: disk.total,
      free: disk.free,
      used: disk.used,
      totalFormatted: formatBytes(disk.total),
      freeFormatted: formatBytes(disk.free),
      usedFormatted: formatBytes(disk.used),
      downloadPath
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/storage/tree', async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ where: { key: 'deluge_download_path' } });
    if (!setting || !setting.value) {
      return res.status(400).json({ error: 'Caminho do Deluge não descoberto ainda. Vá nas configurações e descubra-o primeiro.' });
    }
    const targetDir = setting.value;

    const tree = await withSWRCache('storage_tree', 60, async () => {
      console.log(`[Storage] Iniciando mapeamento da pasta: ${targetDir}`);
      
      const { Worker } = require('worker_threads');
      
      let rootFiles;
      try { 
        rootFiles = await fs.promises.readdir(targetDir); 
      } catch(e) { 
        console.error(`[Storage] Erro ao ler a pasta raiz do Deluge (${targetDir}):`, e.message);
        throw new Error("Não foi possível ler o diretório raiz."); 
      }
      
      console.log(`[Storage] Foram encontrados ${rootFiles.length} itens na raiz.`);
      
      const rootPaths = rootFiles.map(f => path.join(targetDir, f));
      
      // Divisão exata para 2 threads
      const half = Math.ceil(rootPaths.length / 2);
      const chunk1 = rootPaths.slice(0, half);
      const chunk2 = rootPaths.slice(half);
      
      const runWorker = (pathsChunk) => {
        return new Promise((resolve, reject) => {
          if (pathsChunk.length === 0) return resolve([]);
          const worker = new Worker(path.join(__dirname, 'storage_worker.js'), {
            workerData: { paths: pathsChunk, maxDepth: 5 }
          });
          worker.on('message', msg => {
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.results);
          });
          worker.on('error', reject);
          worker.on('exit', code => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
          });
        });
      };
      
      // Executamos as duas threads em paralelo
      const [results1, results2] = await Promise.all([
        runWorker(chunk1),
        runWorker(chunk2)
      ]);
      
      const rootChildren = [...results1, ...results2];
      
      let rootSize = 0;
      for (const child of rootChildren) {
         rootSize += child.value;
      }
      
      return { 
         name: path.basename(targetDir), 
         path: targetDir, 
         value: rootSize, 
         children: rootChildren 
      };
    });

    const disk = await getDiskSpace(targetDir);

    res.json({ tree, disk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/storage/delete', async (req, res) => {
  const { path: targetPath, paths: targetPaths } = req.body;
  
  let pathsToDelete = [];
  if (targetPath) pathsToDelete.push(targetPath);
  if (targetPaths && Array.isArray(targetPaths)) pathsToDelete.push(...targetPaths);
  
  if (pathsToDelete.length === 0) {
    return res.status(400).json({ error: 'Caminho ou lista de caminhos é obrigatório' });
  }
  
  try {
    const setting = await SystemSetting.findOne({ where: { key: 'deluge_download_path' } });
    if (!setting || !setting.value) {
      return res.status(400).json({ error: 'Caminho do Deluge não definido.' });
    }
    
    // Valida se todos os caminhos começam na pasta de downloads do Deluge
    for (const p of pathsToDelete) {
      if (!p.startsWith(setting.value)) {
        return res.status(403).json({ error: `Operação negada. O caminho deve estar dentro do diretório de downloads do Deluge: ${p}` });
      }
    }
    
    // Executa a remoção física
    for (const p of pathsToDelete) {
      fs.rmSync(p, { recursive: true, force: true });
    }
    
    await invalidateCache('storage_tree');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Função para verificar sequencialmente todas as páginas monitoradas ativas no banco de dados com pausa entre URLs
async function checkMonitoredPagesTask() {
  console.log('[MonitoredPages] Iniciando verificação sequencial de páginas monitoradas...');
  try {
    // Ordena pela data em que teve novos torrents/alteração de conteúdo por último (lastContentChangedAt DESC)
    const pages = await MonitoredPage.findAll({
      where: { monitor: true },
      order: [
        [sequelize.fn('COALESCE', sequelize.col('lastContentChangedAt'), sequelize.col('createdAt')), 'DESC'],
        ['lastCheckedAt', 'ASC']
      ]
    });

    if (pages.length === 0) {
      console.log('[MonitoredPages] Nenhuma página com monitoramento ativo encontrada.');
      return { checkedCount: 0, addedTotal: 0 };
    }

    console.log(`[MonitoredPages] Encontradas ${pages.length} páginas para verificação. Processando com pausa entre URLs...`);

    let addedTotal = 0;
    const client = await getDelugeClient().catch(() => null);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        console.log(`[MonitoredPages] (${i + 1}/${pages.length}) Verificando URL (ID: ${page.id}): ${page.url}`);
        const magnetsFoundMap = new Map();

        // 1. Tenta fetch HTTP
        try {
          const response = await fetch(page.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
          });
          if (response.ok) {
            const html = await response.text();
            const pageTorrents = extractAllTorrentsFromHtml(html);
            pageTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
            const pTitle = extractPageTitle(html);
            if (pTitle && pTitle !== page.title) {
              page.title = pTitle;
            }
            const pImg = extractFeaturedImage(html, page.url);
            if (pImg) {
              page.imageUrl = pImg;
            }
          }
        } catch (fErr) {
          console.error(`[MonitoredPages] Erro no fetch de ${page.url}:`, fErr.message);
        }

        // 2. Fallback Puppeteer se nada foi retornado via Fetch
        if (magnetsFoundMap.size === 0) {
          try {
            const puppeteer = require('puppeteer-extra');
            const StealthPlugin = require('puppeteer-extra-plugin-stealth');
            puppeteer.use(StealthPlugin());

            const browser = await puppeteer.launch({
              headless: 'new',
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const pPage = await browser.newPage();
            await pPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await pPage.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
            const renderedHtml = await pPage.content();
            await browser.close();

            const pupTorrents = extractAllTorrentsFromHtml(renderedHtml);
            pupTorrents.forEach((title, mag) => magnetsFoundMap.set(mag, title));
            const pTitle = extractPageTitle(renderedHtml);
            if (pTitle) page.title = pTitle;
            const pImg = extractFeaturedImage(renderedHtml, page.url);
            if (pImg) page.imageUrl = pImg;
          } catch (pErr) {
            console.error(`[MonitoredPages] Erro Puppeteer em ${page.url}:`, pErr.message);
          }
        }

        // 3. Adiciona torrents no Deluge e verifica alteração na contagem
        let pageAddedCount = 0;
        if (client && magnetsFoundMap.size > 0) {
          for (const [mag] of magnetsFoundMap.entries()) {
            try {
              const spaceCheck = await ensureDiskSpaceForTorrent(mag);
              if (!spaceCheck.success) continue;
              await client.addMagnet(mag);
              pageAddedCount++;
              addedTotal++;
            } catch (aErr) {
              // Torrent já existente ou erro silencioso
            }
          }
        }

        const foundCount = magnetsFoundMap.size;
        if (pageAddedCount > 0 || (foundCount > 0 && foundCount !== page.torrentsCount)) {
          page.torrentsCount = foundCount;
          page.lastContentChangedAt = new Date();
          console.log(`[MonitoredPages] Alteração de torrents em ${page.url}! Total: ${foundCount}, Novos adicionados: ${pageAddedCount}`);
        }

        page.lastCheckedAt = new Date();
        await page.save();

        // Pausa sequencial de 3 segundos entre URLs
        if (i < pages.length - 1) {
          console.log('[MonitoredPages] Pausa de 3 segundos antes da próxima URL...');
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (pErr) {
        console.error(`[MonitoredPages] Erro ao verificar página ${page.id}:`, pErr.message);
      }
    }

    await invalidateCache('deluge_torrents');
    console.log(`[MonitoredPages] Verificação sequencial concluída. Páginas: ${pages.length}, Torrents adicionados: ${addedTotal}`);
    return { checkedCount: pages.length, addedTotal };
  } catch (err) {
    console.error('[MonitoredPages] Erro ao executar tarefa de monitoramento:', err.message);
    return { error: err.message };
  }
}

// Função para liberar a porta do servidor matando qualquer processo antigo
async function liberarPortaServidor() {
  const port = process.env.PORT || 4182;
  console.log(`[Startup] Verificando se a porta ${port} está ocupada...`);
  
  if (process.platform !== 'win32') {
    try {
      // Tenta usar fuser para liberar a porta no Linux/macOS
      await execPromise(`fuser -k ${port}/tcp`).catch(() => {});
      console.log(`[Startup] Comando de liberação da porta ${port} enviado (fuser).`);
      
      // Pequena pausa para garantir que o SO liberou a porta
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`[Startup] Aviso ao liberar porta com fuser:`, err.message);
    }
  } else {
    try {
      // Windows check
      const { stdout } = await execPromise(`netstat -ano | findstr :${port}`).catch(() => ({ stdout: '' }));
      if (stdout && stdout.trim()) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && pid !== process.pid.toString()) {
              console.log(`[Startup] Processo antigo detectado no Windows na porta ${port} (PID: ${pid}). Terminando...`);
              await execPromise(`taskkill /F /PID ${pid}`).catch(() => {});
            }
          }
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      // Ignora erro
    }
  }
}

// Inicialização do Banco de Dados e Servidor
liberarPortaServidor().catch(err => {
  console.error("[Startup] Erro ao liberar porta do servidor:", err.message);
}).finally(() => {
  initDatabase().then(async () => {
    // Reseta buscas que ficaram travadas no estado "searching" devido a quedas/reinicializações
    try {
      const { Search } = require('./database');
      const [affectedCount] = await Search.update(
        { status: 'stopped' },
        { where: { status: 'searching' } }
      );
      if (affectedCount > 0) {
        console.log(`[Startup] Redefinidas ${affectedCount} buscas travadas em "searching" para "stopped".`);
      }
    } catch (err) {
      console.error("Erro ao limpar buscas travadas na inicialização:", err);
    }

    // Agenda reinício automático das buscas não concluídas após 60 segundos
    setTimeout(async () => {
      try {
        console.log('[Startup] Iniciando retomada automática de buscas...');
        const { Search } = require('./database');
        const { enqueueSearch } = require('./agent');
        const { Op } = require('sequelize');

        const searchesToResume = await Search.findAll({
          where: {
            status: { [Op.ne]: 'completed' }
          },
          order: [['id', 'DESC']]
        });

        if (searchesToResume.length > 0) {
          console.log(`[Startup] Encontradas ${searchesToResume.length} buscas não concluídas. Enfileirando por ordem de recência...`);
          for (const search of searchesToResume) {
            enqueueSearch(search.id, true);
          }
        } else {
          console.log('[Startup] Nenhuma busca pendente ou não concluída para reiniciar.');
        }
      } catch (err) {
        console.error('[Startup] Erro ao retomar buscas pendentes:', err.message);
      }
    }, 60000); // 60 segundos

    // Executa a verificação inicial do Deluge de forma assíncrona
    verificarDeluge().catch(err => {
      console.error("Erro na verificação inicial do Deluge:", err.message);
    });

    // Descobre o caminho do Deluge no servidor se ainda não foi mapeado
    discoverDelugePath().catch(err => {
      console.error("Erro ao descobrir o caminho inicial do Deluge:", err.message);
    });

    // Executa a verificação inicial de armazenamento na inicialização da aplicação (respeitando os limites)
    setTimeout(() => {
      runStartupStorageCheck().catch(err => {
        writeStorageLog(`[Startup] Erro na verificação inicial de armazenamento: ${err.message}`);
      });
    }, 3000); // 3 segundos após boot

    // Executa a verificação inicial das páginas monitoradas ao iniciar o servidor
    setTimeout(() => {
      checkMonitoredPagesTask().catch(err => {
        console.error("Erro na verificação inicial das páginas monitoradas:", err.message);
      });
    }, 10000); // 10 segundos após o boot

    // Agenda a verificação periódica das páginas monitoradas a cada 12 horas
    setInterval(() => {
      checkMonitoredPagesTask().catch(err => {
        console.error("Erro no ciclo de 12h das páginas monitoradas:", err.message);
      });
    }, 12 * 60 * 60 * 1000);

    function obterIpLocal() {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
          if (net.family === familyV4Value && !net.internal) {
            return net.address;
          }
        }
      }
      return '127.0.0.1';
    }

    app.listen(PORT, () => {
      const ipLocal = obterIpLocal();
      console.log(`===================================================`);
      console.log(` Servidor rodando em: http://localhost:${PORT}`);
      console.log(` IP Local: http://${ipLocal}:${PORT}`);
      console.log(` Banco de dados SQLite conectado com sucesso.`);
      console.log(`===================================================`);
    });
  }).catch(err => {
    console.error("Falha ao inicializar o banco de dados:", err);
  });
});

