const express = require('express');
const path = require('path');
const { initDatabase, Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource, CacheEntry } = require('./database');
const { enqueueSearch, stopSearchAgent, testConnection } = require('./agent');
const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');
const { DelugeClient } = require('./gerenciar_deluge');

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

// Gerenciamento de conexões SSE em tempo real
const sseClients = new Map(); // searchId -> Set de Response

global.sseBroadcast = (searchId, eventData) => {
  const clients = sseClients.get(Number(searchId));
  if (clients) {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    clients.forEach(res => {
      try {
        res.write(payload);
      } catch (err) {
        console.error("Erro ao enviar dados SSE para cliente:", err.message);
      }
    });
  }
};

// --- CACHE SWR (Stale-While-Revalidate) ---
// Retorna dado em cache imediatamente (mesmo que velho) e revalida em background.
// Isso garante que o frontend não fica travado esperando queries pesadas no DietPi.
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
      
      // Revalida de forma assíncrona (não bloqueia a resposta)
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
        }
      });
      
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
    await CacheEntry.destroy({ where: { key: { [Op.in]: keys } } });
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
    
    if (!name || !url || !searchUrlPattern) {
      return res.status(400).json({ error: 'Nome, URL base e Padrão de URL de Busca são obrigatórios.' });
    }
    
    const source = await SearchSource.create({
      name: name.trim(),
      url: url.trim(),
      searchUrlPattern: searchUrlPattern.trim(),
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
    
    await source.update({
      name: name !== undefined ? name.trim() : source.name,
      url: url !== undefined ? url.trim() : source.url,
      searchUrlPattern: searchUrlPattern !== undefined ? searchUrlPattern.trim() : source.searchUrlPattern,
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
      await TorrentResult.destroy({ where: { searchId } });
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
        order: [['updatedAt', 'DESC']],
        limit: 10
      });
      
      const searchesWithStats = await Promise.all(searches.map(async (search) => {
        const resultsCount = await TorrentResult.count({ where: { searchId: search.id } });
        return {
          ...search.toJSON(),
          resultsCount
        };
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


// --- 10. ROTAS DO DELUGE ---

// Retorna o status de conexão com o Deluge
app.get('/api/deluge/status', async (req, res) => {
  await verificarDeluge();
  res.json({
    disponivel: delugeDisponivel,
    port: delugeCreds ? delugeCreds.delugeWeb.porta : null,
    error: delugeErro
  });
});

// Lista todos os torrents e seus status no Deluge
app.get('/api/deluge/torrents', async (req, res) => {
  try {
    const client = await getDelugeClient();
    const torrents = await client.getStatus();
    res.json({ success: true, torrents });
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
      let disponivel = false;
      let port = null;
      let torrents = {};

      try {
        const client = await getDelugeClient();
        torrents = await client.getStatus();
        disponivel = true;
        port = client.port;
      } catch (err) {
        disponivel = false;
      }

      res.write(`data: ${JSON.stringify({ disponivel, port, torrents })}\n\n`);
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
    res.json({ success: true, results });
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
    
    res.json({ success: true, count: errorIds.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Inicialização do Banco de Dados e Servidor
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

  // Executa a verificação inicial do Deluge de forma assíncrona
  verificarDeluge().catch(err => {
    console.error("Erro na verificação inicial do Deluge:", err.message);
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

