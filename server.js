const express = require('express');
const path = require('path');
const { initDatabase, Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource, CacheEntry, sequelize } = require('./database');
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
  const { magnetLink } = req.body;
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link é obrigatório.' });
  }
  try {
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
  const { magnetLinks } = req.body;
  if (!magnetLinks || !Array.isArray(magnetLinks)) {
    return res.status(400).json({ error: 'Lista de magnet links é obrigatória.' });
  }
  try {
    const client = await getDelugeClient();
    const results = [];
    for (const magnet of magnetLinks) {
      try {
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

// Adiciona torrents via Magnet Link direto ou extraindo Magnet Links de uma URL de página web
app.post('/api/deluge/add-url', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'Magnet Link ou URL é obrigatório.' });
  }

  const inputStr = url.trim();

  try {
    const magnetsFound = new Set();
    const magnetRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;

    // 1. Procura por Magnet Links diretos no texto informado
    const matchesInInput = inputStr.match(magnetRegex);
    if (matchesInInput && matchesInInput.length > 0) {
      matchesInInput.forEach(m => magnetsFound.add(m));
    }

    // 2. Se for uma URL (http:// ou https://), tenta buscar o conteúdo HTML da página
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
          const pageMatches = html.match(magnetRegex);
          if (pageMatches && pageMatches.length > 0) {
            pageMatches.forEach(m => {
              const cleanMagnet = m.replace(/&amp;/g, '&');
              magnetsFound.add(cleanMagnet);
            });
          }
        }
      } catch (fetchErr) {
        console.error('Erro ao acessar a URL para extrair magnet links:', fetchErr.message);
        if (magnetsFound.size === 0) {
          return res.status(400).json({
            success: false,
            error: `Não foi possível acessar a URL informada: ${fetchErr.message}`
          });
        }
      }
    }

    if (magnetsFound.size === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum Magnet Link válido foi encontrado no texto ou na página da URL fornecida.'
      });
    }

    const magnetList = Array.from(magnetsFound);
    const client = await getDelugeClient();
    const results = [];

    for (const mag of magnetList) {
      try {
        const torrentId = await client.addMagnet(mag);
        results.push({ magnet: mag, success: true, torrentId });
      } catch (addErr) {
        if (addErr.message && addErr.message.includes('already in session')) {
          results.push({ magnet: mag, success: true, alreadyExists: true });
        } else {
          results.push({ magnet: mag, success: false, error: addErr.message });
        }
      }
    }

    await invalidateCache('deluge_torrents');

    const addedCount = results.filter(r => r.success && !r.alreadyExists).length;
    const existingCount = results.filter(r => r.alreadyExists).length;
    const failedCount = results.filter(r => !r.success).length;

    return res.json({
      success: true,
      totalFound: magnetList.length,
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

