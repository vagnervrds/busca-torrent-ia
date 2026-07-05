const express = require('express');
const path = require('path');
const { initDatabase, Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource } = require('./database');
const { runSearchAgent, stopSearchAgent } = require('./agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

    // Inicia o agente em segundo plano assincronamente
    runSearchAgent(search.id, false).catch(err => {
      console.error(`Erro na execução do agente #${search.id}:`, err);
    });

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
    }

    search.status = 'pending';
    await search.save();

    global.sseBroadcast(searchId, { type: 'restart', data: { resume } });

    runSearchAgent(searchId, resume).catch(err => {
      console.error(`Erro ao reiniciar o agente #${searchId}:`, err);
    });

    res.json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Listar todas as buscas
app.get('/api/searches', async (req, res) => {
  try {
    const searches = await Search.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    const searchesWithStats = await Promise.all(searches.map(async (search) => {
      const resultsCount = await TorrentResult.count({ where: { searchId: search.id } });
      return {
        ...search.toJSON(),
        resultsCount
      };
    }));

    res.json(searchesWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Obter detalhes, resultados e logs de uma busca
app.get('/api/searches/:id', async (req, res) => {
  const searchId = Number(req.params.id);
  try {
    const search = await Search.findByPk(searchId, {
      include: [
        { model: TorrentResult, as: 'results' },
        { model: AgentLog, as: 'logs', order: [['createdAt', 'ASC']] }
      ]
    });

    if (!search) {
      return res.status(404).json({ error: 'Busca não encontrada.' });
    }

    res.json(search);
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

// Inicialização do Banco de Dados e Servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` Servidor rodando em: http://localhost:${PORT}`);
    console.log(` Banco de dados SQLite conectado com sucesso.`);
    console.log(`===================================================`);
  });
}).catch(err => {
  console.error("Falha ao inicializar o banco de dados:", err);
});
