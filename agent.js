const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource } = require('./database');

// Habilita o plugin stealth para evitar detecção de robô
puppeteer.use(StealthPlugin());

// Mapa para controle de buscas ativas em memória (cancelamento imediato)
const activeSearches = new Map(); // searchId -> { token: { stopped: false }, browser: Browser }

// Eventos e controle para otimizador de fontes de busca
const EventEmitter = require('events');
const analysisEvents = new EventEmitter();
const activeOptimizations = new Map(); // sourceId -> { browser: Browser, aborted: boolean }

// Fila para gerenciar a execução sequencial de buscas e economizar recursos do servidor
const searchQueue = []; // Array of { searchId, resumeMode }
let isProcessingQueue = false;

// Helper para ler as configurações do banco em tempo real
async function getSettings() {
  const settingsList = await SystemSetting.findAll();
  const settings = {};
  settingsList.forEach(s => {
    settings[s.key] = s.value;
  });
  return {
    aiProvider: settings.aiProvider || 'openai',
    aiUrl: settings.aiUrl || 'http://localhost:8045/v1',
    aiToken: settings.aiToken || 'SUA_API_KEY_AQUI',
    aiModel: settings.aiModel || 'gemini-3-flash',
    preferredLanguage: settings.preferredLanguage || 'Português',
    preferredResolution: settings.preferredResolution || '1080p'
  };
}

// Detecta o executável do Chromium do sistema (necessário em DietPi/Linux ARM)
// O Puppeteer bundled frequentemente não funciona em ARM ou distros minimalistas
function detectChromiumExecutable() {
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[Puppeteer] Chromium do sistema encontrado em: ${p}`);
        return p;
      }
    } catch (e) {}
  }
  console.log('[Puppeteer] Chromium do sistema não encontrado. Usando bundled do Puppeteer.');
  return null; // Usa o bundled
}

// Garante que não há instâncias de browser vazando antes de lançar um novo
// Percorre o activeSearches e fecha browsers de buscas já encerradas
async function ensureNoBrowserLeaks() {
  const idsParaLimpar = [];
  
  for (const [searchId, active] of activeSearches.entries()) {
    if (!active || !active.browser) continue;
    
    try {
      // Verifica no banco se a busca ainda está de fato ativa
      const search = await Search.findByPk(searchId);
      const isInactive = !search || 
        ['stopped', 'completed', 'failed'].includes(search.status) ||
        active.token.stopped;
        
      if (isInactive) {
        console.log(`[BrowserLeakGuard] Fechando browser órfão da busca #${searchId} (status: ${search?.status || 'não encontrada'})`);
        try {
          await active.browser.close();
        } catch (e) {
          // Ignora se já estava fechado
        }
        idsParaLimpar.push(searchId);
      }
    } catch (e) {
      console.error(`[BrowserLeakGuard] Erro ao verificar busca #${searchId}:`, e.message);
    }
  }
  
  for (const id of idsParaLimpar) {
    activeSearches.delete(id);
  }
  
  if (idsParaLimpar.length > 0) {
    console.log(`[BrowserLeakGuard] ${idsParaLimpar.length} browser(s) órfão(s) encerrado(s).`);
  }
}

// Prepara a página para simular um navegador humano real e evitar bloqueios
async function preparePageForHumanLikeBehavior(page) {
  // Viewport realista
  await page.setViewport({ width: 1920, height: 1080 });

  // User-Agent moderno e comum
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  // Cabeçalhos HTTP padrão de navegador real
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  });

  // Oculta assinaturas comuns do Puppeteer
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en']
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' }
      ]
    });
  });
}

// Simula pequenas interações físicas para parecer mais humano
async function simulateHumanInteraction(page) {
  try {
    await page.mouse.move(100, 100);
    await page.mouse.move(300, 200, { steps: 5 });
    
    await page.evaluate(() => {
      window.scrollBy(0, 150);
    });
    await new Promise(r => setTimeout(r, 250));
    await page.evaluate(() => {
      window.scrollBy(0, -150);
    });
  } catch (e) {
    // Ignora erros na simulação
  }
}

// Lanca o browser com retry (até 3 tentativas) e timeout estendido para hardware limitado
// Remove --single-process que é a causa direta do erro de WS timeout no Linux
async function launchBrowserWithRetry(searchId) {
  // Limpa browsers órfãos antes de lançar novo
  await ensureNoBrowserLeaks();
  
  const executablePath = detectChromiumExecutable();
  
  // Flags otimizadas para DietPi/Linux ARM com hardware limitado
  // NOTA: --single-process REMOVIDA intencionalmente — causa timeout de WS no Linux
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',       // Crítico em hardware limitado (pouca /dev/shm)
    '--disable-blink-features=AutomationControlled',
    '--window-size=1366,768',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--no-zygote',                   // Reduz uso de processos filhos
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--mute-audio',
    '--no-first-run',
    '--disable-infobars'
  ];
  
  const launchOptions = {
    headless: true,
    args: launchArgs,
    timeout: 90000,          // 90s para hardware lento como DietPi
    protocolTimeout: 90000   // Também estende o timeout do protocolo CDP
  };
  
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  
  const maxAttempts = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        const delay = attempt * 3000; // 3s, 6s entre tentativas
        await logAgent(searchId, `[Puppeteer] Tentativa ${attempt}/${maxAttempts} de iniciar o browser (aguardando ${delay/1000}s)...`, 'warn');
        await new Promise(r => setTimeout(r, delay));
      }
      
      const browser = await puppeteer.launch(launchOptions);
      if (attempt > 1) {
        await logAgent(searchId, `[Puppeteer] Browser iniciado com sucesso na tentativa ${attempt}.`, 'info');
      }
      return browser;
    } catch (err) {
      lastError = err;
      console.error(`[Puppeteer] Falha ao iniciar browser (tentativa ${attempt}/${maxAttempts}):`, err.message);
      
      if (attempt < maxAttempts) {
        await logAgent(searchId, `[Puppeteer] Falha ao iniciar browser: ${err.message}. Tentando novamente...`, 'warn');
      }
    }
  }
  
  throw new Error(`Falha ao iniciar o browser após ${maxAttempts} tentativas. Último erro: ${lastError?.message}`);
}

// Helper para logs com SSE
async function logAgent(searchId, message, level = 'info') {
  console.log(`[Busca #${searchId || 'SISTEMA'}] [${level.toUpperCase()}] ${message}`);
  if (!searchId) return;
  const log = await AgentLog.create({ searchId, message, level });
  
  if (global.sseBroadcast) {
    global.sseBroadcast(searchId, {
      type: 'log',
      data: {
        id: log.id,
        message,
        level,
        createdAt: log.createdAt
      }
    });
  }
}

// Helper para salvar resultados com SSE
async function saveResult(searchId, resultData) {
  const result = await TorrentResult.create({
    searchId,
    ...resultData
  });
  
  if (global.sseBroadcast) {
    global.sseBroadcast(searchId, {
      type: 'result',
      data: result
    });
  }
  return result;
}

// Helper para calcular o custo estimado da chamada de IA
function calculateCost(modelName, promptTokens, completionTokens) {
  const model = String(modelName).toLowerCase();
  let inputRate = 0.15 / 1000000; // fallback padrão (como gpt-4o-mini)
  let outputRate = 0.60 / 1000000;
  
  if (model.includes('sonnet') || model.includes('claude-3-5')) {
    inputRate = 3.00 / 1000000;
    outputRate = 15.00 / 1000000;
  } else if (model.includes('haiku')) {
    inputRate = 0.80 / 1000000;
    outputRate = 4.00 / 1000000;
  } else if (model.includes('opus')) {
    inputRate = 15.00 / 1000000;
    outputRate = 75.00 / 1000000;
  } else if (model.includes('gpt-4o-mini')) {
    inputRate = 0.15 / 1000000;
    outputRate = 0.60 / 1000000;
  } else if (model.includes('gpt-4o')) {
    inputRate = 2.50 / 1000000;
    outputRate = 10.00 / 1000000;
  } else if (model.includes('flash') || model.includes('gemini-2.5') || model.includes('gemini-3')) {
    inputRate = 0.075 / 1000000;
    outputRate = 0.30 / 1000000;
  } else if (model.includes('pro')) {
    inputRate = 1.25 / 1000000;
    outputRate = 5.00 / 1000000;
  }
  
  return (promptTokens * inputRate) + (completionTokens * outputRate);
}

// Helper de chamada do LLM híbrido (OpenAI ou Anthropic)
async function callLLM(searchId, messages, jsonMode = false) {
  const config = await getSettings();
  const maxAttempts = 11; // 1 tentativa inicial + 10 retentativas
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let endpoint = '';
      let headers = { 'Content-Type': 'application/json' };
      let body = {};
      
      if (config.aiProvider === 'anthropic') {
        // Formata endpoint para Anthropic Claude
        endpoint = config.aiUrl.endsWith('/messages') 
          ? config.aiUrl 
          : (config.aiUrl.endsWith('/v1') ? `${config.aiUrl}/messages` : `${config.aiUrl}/v1/messages`);
          
        headers['x-api-key'] = config.aiToken;
        headers['anthropic-version'] = '2023-06-01';
        
        // Conversão de formato de mensagens OpenAI -> Anthropic
        let systemPrompt = "";
        let filteredMessages = [];
        for (const msg of messages) {
          if (msg.role === 'system') {
            systemPrompt = msg.content;
          } else {
            filteredMessages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            });
          }
        }
        
        // Para Anthropic, adicionamos instrução explícita de JSON se for jsonMode
        if (jsonMode) {
          systemPrompt += "\nVOCÊ DEVE RESPONDER APENAS COM UM OBJETO JSON VÁLIDO. NÃO inclua nenhuma introdução, explicação ou tags markdown de bloco de código do tipo ```json.";
        }
        
        body = {
          model: config.aiModel,
          max_tokens: 4000,
          temperature: 0.1,
          system: systemPrompt,
          messages: filteredMessages
        };
      } else {
        // OpenAI Compatible
        endpoint = config.aiUrl.endsWith('/chat/completions') 
          ? config.aiUrl 
          : (config.aiUrl.endsWith('/v1') ? `${config.aiUrl}/chat/completions` : `${config.aiUrl}/v1/chat/completions`);
          
        headers['Authorization'] = `Bearer ${config.aiToken}`;
        
        body = {
          model: config.aiModel,
          messages: messages,
          temperature: 0.1
        };
        
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API de IA (${config.aiProvider}) respondeu com erro ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      let content = '';
      
      if (config.aiProvider === 'anthropic') {
        content = data.content[0].text.trim();
      } else {
        content = data.choices[0].message.content.trim();
      }
      
      // Contabiliza o custo se houver informações de usage
      let promptTokens = 0;
      let completionTokens = 0;
      if (data.usage) {
        if (config.aiProvider === 'anthropic') {
          promptTokens = data.usage.input_tokens || 0;
          completionTokens = data.usage.output_tokens || 0;
        } else {
          promptTokens = data.usage.prompt_tokens || 0;
          completionTokens = data.usage.completion_tokens || 0;
        }
      }
      
      const callCost = calculateCost(config.aiModel, promptTokens, completionTokens);
      if (searchId && callCost > 0) {
        const searchRecord = await Search.findByPk(searchId);
        if (searchRecord) {
          searchRecord.cost = (searchRecord.cost || 0.0) + callCost;
          await searchRecord.save();
          
          if (global.sseBroadcast) {
            global.sseBroadcast(searchId, {
              type: 'cost_change',
              data: { cost: searchRecord.cost }
            });
          }
        }
      }
      
      // Limpa blocos de código markdown se o modelo retornar ```json ... ``` ou ``` ... ```
      if (content.startsWith('```')) {
        content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
      }
      
      if (jsonMode) {
        // Segurança contra retornos de JSON malformados ou envoltos em texto extra pela IA
        try {
          return JSON.parse(content);
        } catch (jsonErr) {
          // Tenta extrair a parte {...} se a IA colocou textos fora
          const jsonStart = content.indexOf('{');
          const jsonEnd = content.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
          }
          throw jsonErr;
        }
      }
      return content;
    } catch (err) {
      console.error(`Erro ao chamar LLM (${config.aiProvider}, tentativa ${attempt}/${maxAttempts}):`, err.message);
      if (attempt === maxAttempts) throw err;
      
      // Cálculo de recuo exponencial randômico (random exponential backoff)
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = Math.min(30000, baseDelay + jitter); // Máximo de 30 segundos
      
      const seconds = (delay / 1000).toFixed(1);
      await logAgent(
        searchId, 
        `Erro na chamada da API de IA (${config.aiProvider}): ${err.message}. Retentando (${attempt}/${maxAttempts - 1}) em ${seconds}s...`, 
        'warn'
      );
      
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Interrompe uma busca ativa ou a remove da fila se estiver pendente
async function stopSearchAgent(searchId) {
  // Remove da fila se estiver lá
  const idx = searchQueue.findIndex(item => item.searchId === searchId);
  if (idx !== -1) {
    searchQueue.splice(idx, 1);
    await logAgent(searchId, "Busca removida da fila antes de iniciar.", "warn");
  }

  const search = await Search.findByPk(searchId);
  if (search && (search.status === 'searching' || search.status === 'pending')) {
    search.status = 'stopped';
    await search.save();
    await logAgent(searchId, "Busca interrompida pelo usuário.", "warn");
  }
  
  const active = activeSearches.get(searchId);
  if (active) {
    active.token.stopped = true;
    if (active.browser) {
      try {
        await active.browser.close();
      } catch (e) {
        // Silencia erro se já estiver fechado
      }
    }
    activeSearches.delete(searchId);
  }
  
  if (global.sseBroadcast) {
    global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'stopped' } });
  }
}

// Enfileira uma busca para execução sequencial
function enqueueSearch(searchId, resumeMode) {
  if (!searchQueue.some(item => item.searchId === searchId)) {
    searchQueue.push({ searchId, resumeMode });
    logAgent(searchId, "Busca colocada na fila de processamento.", "info").catch(console.error);
  }
  processSearchQueue();
}

// Processa a fila de buscas, garantindo concorrência máxima de 1 busca por vez
async function processSearchQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    // Conta quantas buscas estão ativas no momento na memória
    let activeCount = 0;
    for (const [id, active] of activeSearches.entries()) {
      if (active && !active.token.stopped) {
        activeCount++;
      }
    }

    if (activeCount >= 1) {
      isProcessingQueue = false;
      return;
    }

    if (searchQueue.length === 0) {
      isProcessingQueue = false;
      return;
    }

    const nextItem = searchQueue.shift();

    // Executa em segundo plano
    runSearchAgent(nextItem.searchId, nextItem.resumeMode)
      .catch(err => {
        console.error(`Erro na execução do agente #${nextItem.searchId}:`, err);
      })
      .finally(() => {
        isProcessingQueue = false;
        // Processa o próximo da fila
        processSearchQueue();
      });

  } catch (err) {
    console.error("Erro no processamento da fila de buscas:", err);
    isProcessingQueue = false;
  }
}

// Agente Principal de Busca
async function runSearchAgent(searchId, resumeMode = true) {
  const search = await Search.findByPk(searchId);
  if (!search) return;
  
  // Cancela se já houver uma rodando para o mesmo ID
  if (activeSearches.has(searchId)) {
    await stopSearchAgent(searchId);
  }
  
  // Cria Token de Cancelamento
  const token = { stopped: false };
  activeSearches.set(searchId, { token, browser: null });
  
  let browser = null;
  try {
    search.status = 'searching';
    await search.save();
    
    if (global.sseBroadcast) {
      global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'searching' } });
    }
    
    const config = await getSettings();
    await logAgent(searchId, `Iniciando agente de IA para busca: "${search.query}"`, 'info');
    await logAgent(searchId, `Idioma preferencial: ${config.preferredLanguage} | Resolução: ${config.preferredResolution}`, 'info');
    
    // Se não for modo de retomada, limpa resultados anteriores
    if (!resumeMode) {
      await TorrentResult.destroy({ where: { searchId } });
      await TorrentEvaluation.destroy({ where: { searchId } });
      await logAgent(searchId, "Limpo histórico de busca anterior. Iniciando do zero.", "info");
    } else {
      await logAgent(searchId, "Modo de Retomada ativo. Carregando histórico para pular torrents já avaliados.", "info");
    }
    
    // Passo 1: IA decide quais fontes de busca utilizar
    const activeSources = await SearchSource.findAll({ where: { isActive: true } });
    if (activeSources.length === 0) {
      await logAgent(searchId, "Nenhuma fonte de busca ativa encontrada no banco de dados. Crie ou ative pelo menos uma fonte.", "error");
      search.status = 'failed';
      await search.save();
      return;
    }
    
    await logAgent(searchId, "IA analisando quais fontes de busca fazem sentido para a consulta...", "info");
    const sourceDetails = activeSources.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      contentTypes: JSON.parse(s.contentTypes)
    }));
    
    const selectSourcesPrompt = [
      {
        role: "system",
        content: "Você é um roteador inteligente. Sua função é analisar a consulta do usuário e selecionar quais das fontes de busca cadastradas são adequadas para responder a essa consulta."
      },
      {
        role: "user",
        content: `Consulta do Usuário: "${search.query}"
        
        Fontes de Busca Disponíveis:
        ${JSON.stringify(sourceDetails, null, 2)}
        
        Selecione apenas as fontes que fazem sentido pesquisar. Por exemplo, se a consulta for sobre animes ou mangás, selecione fontes adequadas (como Nyaa.si). Se for sobre livros gerais, escolha fontes que indexem livros.
        Retorne uma lista JSON dos IDs das fontes selecionadas.
        
        Responda APENAS com um objeto JSON no formato exato:
        {
          "selectedIds": [1, 2]
        }`
      }
    ];
    
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    const sourceSelectionResult = await callLLM(searchId, selectSourcesPrompt, true);
    const selectedSourceIds = sourceSelectionResult.selectedIds || [];
    const selectedSources = activeSources.filter(s => selectedSourceIds.includes(s.id));
    
    if (selectedSources.length === 0) {
      await logAgent(searchId, "A IA determinou que nenhuma das fontes ativas é relevante para esta busca. Usando a primeira fonte ativa por padrão.", "warn");
      selectedSources.push(activeSources[0]);
    }
    
    await logAgent(searchId, `Fontes de busca ativadas: ${selectedSources.map(s => s.name).join(', ')}`, 'info');
    
    // Passo 2: LLM sugere palavras-chave otimizadas
    const keywordAnalysisPrompt = [
      {
        role: "system",
        content: "Você é um assistente especialista em torrents. Seu objetivo é ajudar a encontrar o conteúdo desejado gerando os termos de pesquisa mais eficientes."
      },
      {
        role: "user",
        content: `O usuário quer encontrar torrents que correspondam a: "${search.query}".
        Forneça até 2 palavras-chave de busca recomendadas para realizar nos sites indexadores de torrents.
        Gere títulos limpos e simplificados.
        
        Responda APENAS com um objeto JSON no formato exato:
        {
          "keywords": ["termo1", "termo2"]
        }`
      }
    ];
    
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    const keywordsResult = await callLLM(searchId, keywordAnalysisPrompt, true);
    let currentKeywords = keywordsResult.keywords || [search.query];
    
    // Se a IA retornar vazio por algum motivo, garante o termo original
    if (currentKeywords.length === 0) {
      currentKeywords = [search.query];
    }
    
    const attemptedKeywords = [];
    for (const kw of currentKeywords) {
      if (!attemptedKeywords.includes(kw)) {
        attemptedKeywords.push(kw);
      }
    }
    await logAgent(searchId, `Palavras-chave iniciais geradas pela IA: ${currentKeywords.join(', ')}`, 'info');
    
    // Inicializa o Puppeteer com retry e flags otimizadas para DietPi/Linux ARM
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    await logAgent(searchId, 'Iniciando browser (Chromium)...', 'info');
    browser = await launchBrowserWithRetry(searchId);
    
    const active = activeSearches.get(searchId);
    if (active) active.browser = browser;
    
    const page = await browser.newPage();
    
    // Configura disfarce humano na página
    await preparePageForHumanLikeBehavior(page);
    
    // Intercepta e aborta imagens e mídias para economizar banda, mas mantem css/fontes/scripts ativos
    // para evitar bloqueios de detecção de bots
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    let searchCompleted = false;
    let variationCount = 1;
    const maxVariations = 10;
    
    while (variationCount <= maxVariations && !searchCompleted) {
      if (token.stopped) throw new Error('SEARCH_STOPPED');
      
      await logAgent(searchId, `[Variação ${variationCount}/${maxVariations}] Iniciando busca com termos: ${currentKeywords.join(', ')}`, 'info');
      
      // Carrega o histórico de avaliações do DB para esta busca nesta variação
      const existingEvaluations = await TorrentEvaluation.findAll({ where: { searchId } });
      const evaluatedMap = new Map(existingEvaluations.map(e => [e.nyaaId, e.status]));
      
      // Lista para acumular torrents candidatos coletados nesta variação
      let allScrapedTorrents = [];
      
      // Loop pelas fontes e palavras-chave atuais
      for (const source of selectedSources) {
        const isNyaa = source.name.toLowerCase().includes('nyaa') || source.url.includes('nyaa.si');
        
        for (const keyword of currentKeywords) {
          if (token.stopped) throw new Error('SEARCH_STOPPED');
          await logAgent(searchId, `Pesquisando no site "${source.name}" por: "${keyword}"...`, 'info');
          
          // Substitui {query} no padrão da URL de busca
          const searchUrl = source.searchUrlPattern.replace('{query}', encodeURIComponent(keyword));
          
          try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await new Promise(r => setTimeout(r, 1500));
            
            // Simulação de comportamento humano
            await simulateHumanInteraction(page);
            
            // Detecção ativa de Cloudflare
            const pageTitle = await page.title();
            if (pageTitle.includes('Cloudflare') || pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
              await logAgent(searchId, `[Cloudflare] Desafio de segurança detectado em ${source.name}. Aguardando desafio automático por 8s...`, 'warn');
              await new Promise(r => setTimeout(r, 8000));
              const pageTitleRetry = await page.title();
              if (pageTitleRetry.includes('Cloudflare') || pageTitleRetry.includes('Just a moment')) {
                throw new Error("Acesso bloqueado pela proteção contra bots do Cloudflare.");
              }
              await logAgent(searchId, `[Cloudflare] Desafio de segurança superado com sucesso em ${source.name}!`, 'info');
            }
            
            let scraped = [];
            
            if (isNyaa) {
              // Parser Otimizado de Nyaa.si
              const hasResults = await page.evaluate(() => !!document.querySelector('table.torrent-list'));
              if (!hasResults) {
                await logAgent(searchId, `Nenhum resultado encontrado para "${keyword}" em ${source.name}.`, 'warn');
                continue;
              }
              
              scraped = await page.evaluate((sName) => {
                const rows = Array.from(document.querySelectorAll('table.torrent-list tbody tr'));
                return rows.map(tr => {
                  const nameLink = tr.querySelector('td:nth-child(2) a:not([class*="comments"])');
                  const magnetLink = tr.querySelector('td:nth-child(3) a[href^="magnet:"]');
                  const sizeTd = tr.querySelector('td:nth-child(4)');
                  const dateTd = tr.querySelector('td:nth-child(5)');
                  const seedsTd = tr.querySelector('td:nth-child(6)');
                  const leechesTd = tr.querySelector('td:nth-child(7)');
                  
                  return {
                    title: nameLink ? nameLink.innerText.trim() : '',
                    pageUrl: nameLink ? nameLink.href : '',
                    magnetLink: magnetLink ? magnetLink.getAttribute('href') : '',
                    size: sizeTd ? sizeTd.innerText.trim() : '',
                    seeders: seedsTd ? parseInt(seedsTd.innerText.trim(), 10) || 0 : 0,
                    leechers: leechesTd ? parseInt(leechesTd.innerText.trim(), 10) || 0 : 0,
                    sourceName: sName
                  };
                }).filter(r => r.title && r.magnetLink);
              }, source.name);
            } else {
              // RASPAGEM GENÉRICA VIA IA PARA OUTROS SITES
              await logAgent(searchId, `Iniciando raspagem adaptativa em ${source.name}...`, 'info');
              
              // Extrai todos os links do DOM da página e algum contexto de texto
              const rawElements = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return anchors.map((a, idx) => {
                  const text = a.innerText.trim();
                  const href = a.getAttribute('href') || '';
                  const parentText = a.parentElement ? a.parentElement.innerText.substring(0, 150).replace(/\s+/g, ' ').trim() : '';
                  return { index: idx, text, href, parentText };
                }).filter(item => {
                  const isRelevantText = item.text.length > 2;
                  const isTorrentLink = item.href.includes('.torrent') || item.href.startsWith('magnet:') || item.href.includes('/torrent/') || item.href.includes('/view/') || item.href.includes('/download/');
                  return isRelevantText || isTorrentLink;
                }).slice(0, 80);
              });
              
              if (rawElements.length === 0) {
                await logAgent(searchId, `Nenhum link detectado na página de busca de ${source.name}.`, 'warn');
                continue;
              }
              
              // Pergunta ao LLM quais desses links são resultados de torrent válidos
              const parsePrompt = [
                {
                  role: "system",
                  content: "Você é um extrator de dados HTML especialista em páginas de torrent."
                },
                {
                  role: "user",
                  content: `Estamos no site "${source.name}" buscando pelo termo "${keyword}".
                  
                  Abaixo está a lista simplificada de links extraídos da página de busca (com seu índice de array):
                  ${JSON.stringify(rawElements, null, 2)}
                  
                  Identifique quais índices correspondem a resultados de torrent reais relacionados ao termo.
                  Para cada resultado identificado, extraia:
                  - "title": O título do torrent ou arquivo.
                  - "pageUrl": O link da página de detalhes do torrent. Se for um link relativo (ex: "/view/123"), resolva-o completando com a URL base "${source.url}".
                  - "magnetLink": O link magnet completo (começando com "magnet:") se estiver contido na página de buscas. Caso contrário, retorne null.
                  - "size": O tamanho aproximado do arquivo (ex: "1.5 GB"), se puder deduzir a partir do "parentText".
                  - "seeders": O número inteiro de seeds, se puder deduzir a partir do "parentText" (caso não ache, coloque 0).
                  
                  Responda APENAS com um objeto JSON no formato:
                  {
                    "candidates": [
                      { "title": "...", "pageUrl": "...", "magnetLink": "...", "size": "...", "seeders": 10 }
                    ]
                  }`
                }
              ];
              
              try {
                const parseResult = await callLLM(searchId, parsePrompt, true);
                const candidates = parseResult.candidates || [];
                
                scraped = candidates.map(c => ({
                  title: c.title,
                  pageUrl: c.pageUrl,
                  magnetLink: c.magnetLink,
                  size: c.size || 'Desconhecido',
                  seeders: parseInt(c.seeders, 10) || 0,
                  leechers: 0,
                  sourceName: source.name
                }));
              } catch (err) {
                await logAgent(searchId, `Falha na raspagem genérica por IA: ${err.message}`, 'warn');
              }
            }
            
            await logAgent(searchId, `Obtidos ${scraped.length} torrents brutos em ${source.name} para "${keyword}".`, 'info');
            allScrapedTorrents = allScrapedTorrents.concat(scraped);
            
          } catch (err) {
            await logAgent(searchId, `Erro ao navegar ou raspar ${source.name}: ${err.message}`, 'warn');
          }
        }
      }
      
      // Remove duplicados pelo magnetLink ou pela URL da página (se magnet for nulo)
      const uniqueTorrents = Array.from(
        new Map(
          allScrapedTorrents.map(item => [item.magnetLink || item.pageUrl, item])
        ).values()
      );
      
      // Ordena por Seeders (decrescente)
      uniqueTorrents.sort((a, b) => b.seeders - a.seeders);
      
      if (uniqueTorrents.length > 0) {
        // Filtra torrents já avaliados historicamente nesta busca
        const pendingTorrents = uniqueTorrents.filter(torrent => {
          const torrentId = torrent.magnetLink || torrent.pageUrl;
          const uniqueId = torrent.magnetLink 
            ? torrent.magnetLink.split('btih:')[1]?.split('&')[0] || torrentId 
            : torrent.pageUrl.split('/').pop() || torrentId;
            
          torrent.uniqueId = uniqueId;
          return !evaluatedMap.has(uniqueId);
        });
        
        await logAgent(searchId, `Filtro concluído para a variação ${variationCount}: ${uniqueTorrents.length} torrents totais, ${pendingTorrents.length} novos para analisar com IA.`, 'info');
        
        if (pendingTorrents.length > 0) {
          // Passo 3: Filtro Inicial por IA
          const batchSize = 15;
          const candidatesToInspect = [];
          
          for (let i = 0; i < pendingTorrents.length; i += batchSize) {
            if (token.stopped) throw new Error('SEARCH_STOPPED');
            const batch = pendingTorrents.slice(i, i + batchSize);
            await logAgent(searchId, `Análise de relevância inicial do lote ${Math.floor(i / batchSize) + 1} de títulos...`, 'info');
            
            const titlesList = batch.map((t, idx) => ({ index: idx, title: t.title, seeders: t.seeders, size: t.size, source: t.sourceName }));
            
            const filterPrompt = [
              {
                role: "system",
                content: "Você é um classificador de relevância de arquivos de torrent."
              },
              {
                role: "user",
                content: `O usuário busca: "${search.query}".
                Preferências: Resolução: ${config.preferredResolution} | Idioma: ${config.preferredLanguage}.
                
                Aqui está uma lista de torrents encontrados (com seus índices):
                ${JSON.stringify(titlesList, null, 2)}
                
                Selecione os índices correspondentes aos torrents que parecem ser o conteúdo procurado e têm boa qualidade.
                Retorne APENAS um objeto JSON no formato:
                {
                  "selectedIndices": [0, 2]
                }`
              }
            ];
            
            try {
              const filterResult = await callLLM(searchId, filterPrompt, true);
              const indices = filterResult.selectedIndices || [];
              for (const idx of indices) {
                if (batch[idx]) {
                  candidatesToInspect.push(batch[idx]);
                }
              }
            } catch (err) {
              await logAgent(searchId, `Erro ao filtrar títulos: ${err.message}. Verificando lote completo.`, 'warn');
              candidatesToInspect.push(...batch);
            }
          }
          
          await logAgent(searchId, `IA selecionou ${candidatesToInspect.length} candidatos para inspeção profunda de detalhes na variação ${variationCount}.`, 'info');
          
          // Registra os ignorados no filtro inicial para retomada
          const candidateUniqueIds = new Set(candidatesToInspect.map(c => c.uniqueId));
          for (const t of pendingTorrents) {
            if (!candidateUniqueIds.has(t.uniqueId)) {
              await TorrentEvaluation.create({
                searchId,
                nyaaId: t.uniqueId,
                title: t.title,
                status: 'ignored',
                explanation: 'Filtro inicial por título determinou baixa relevância ou qualidade inferior.'
              });
            }
          }
          
          // Passo 4: Inspeção Profunda de cada Candidato
          for (const candidate of candidatesToInspect) {
            if (token.stopped) throw new Error('SEARCH_STOPPED');
            await logAgent(searchId, `Obtendo informações do torrent de detalhes em: "${candidate.title}"...`, 'info');
            
            try {
              let detailData = { description: 'Nenhuma descrição.', files: [], extractedMagnets: [] };
              
              if (candidate.pageUrl) {
                let targetUrl = candidate.pageUrl;
                
                const candidateSource = selectedSources.find(s => s.name === candidate.sourceName) || selectedSources[0];
                if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                  try {
                    targetUrl = new URL(targetUrl, candidateSource.url).href;
                  } catch (e) {
                    await logAgent(searchId, `Ignorando URL de detalhes inválida para "${candidate.title}": ${candidate.pageUrl}`, 'warn');
                    continue;
                  }
                }
                
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 1500));
                
                // Simulação de comportamento humano
                await simulateHumanInteraction(page);
                
                // Detecção ativa de Cloudflare
                const pageTitle = await page.title();
                if (pageTitle.includes('Cloudflare') || pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
                  await logAgent(searchId, `[Cloudflare] Desafio detectado na página de detalhes de ${candidate.title}. Aguardando desafio automático por 8s...`, 'warn');
                  await new Promise(r => setTimeout(r, 8000));
                  const pageTitleRetry = await page.title();
                  if (pageTitleRetry.includes('Cloudflare') || pageTitleRetry.includes('Just a moment')) {
                    throw new Error("Bloqueado pelo Cloudflare na página de detalhes.");
                  }
                }
                
                detailData = await page.evaluate(() => {
                  const descEl = document.getElementById('torrent-description') || document.querySelector('.description') || document.querySelector('.panel-body') || document.querySelector('#description') || document.querySelector('.conteudo') || document.querySelector('.post-content');
                  const filesEl = document.querySelector('.torrent-file-list') || document.querySelector('.files') || document.querySelector('#files') || document.querySelector('.torrent-files') || document.querySelector('.tabela_dados');
                  
                  let files = [];
                  if (filesEl) {
                    files = Array.from(filesEl.querySelectorAll('li, td')).map(li => li.innerText.trim());
                  }
                  
                  const magnetElements = Array.from(document.querySelectorAll('a[href^="magnet:"]'));
                  const extractedMagnets = magnetElements.map((a, idx) => {
                    const href = a.getAttribute('href') || '';
                    let displayName = '';
                    try {
                      const dnMatch = href.match(/[?&]dn=([^&]+)/);
                      if (dnMatch) {
                        displayName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
                      }
                    } catch (e) {}
                    return {
                      index: idx,
                      linkText: a.innerText.trim(),
                      parentText: a.parentElement ? a.parentElement.innerText.substring(0, 150).replace(/\s+/g, ' ').trim() : '',
                      href,
                      displayName
                    };
                  });
                  
                  return {
                    description: descEl ? descEl.innerText.trim() : 'Nenhuma descrição.',
                    files: files.slice(0, 60),
                    extractedMagnets
                  };
                });
              }
              
              let magnetsToEvaluate = detailData.extractedMagnets || [];
              
              if (magnetsToEvaluate.length === 0 && candidate.magnetLink) {
                let displayName = '';
                try {
                  const dnMatch = candidate.magnetLink.match(/[?&]dn=([^&]+)/);
                  if (dnMatch) {
                    displayName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
                  }
                } catch (e) {}
                magnetsToEvaluate.push({
                  index: 0,
                  linkText: candidate.title,
                  parentText: '',
                  href: candidate.magnetLink,
                  displayName: displayName || candidate.title
                });
              }
              
              if (magnetsToEvaluate.length === 0) {
                await logAgent(searchId, `Não foi possível encontrar nenhum link magnet para "${candidate.title}". Pulando.`, 'warn');
                continue;
              }
              
              await logAgent(searchId, `Encontrado(s) ${magnetsToEvaluate.length} link(s) magnet na página de "${candidate.title}". Enviando para avaliação da IA...`, 'info');
              
              const evaluationPrompt = [
                {
                  role: "system",
                  content: `Você é um avaliador inteligente de torrents. Você deve analisar uma página de detalhes de torrent e seus múltiplos links magnet para classificar e selecionar quais links individuais correspondem à busca e preferências do usuário.`
                },
                {
                  role: "user",
                  content: `Busca do Usuário: "${search.query}"
                  Idioma Preferido: "${config.preferredLanguage}"
                  Resolução Recomendada: "${config.preferredResolution}"
                  
                  Título do Torrent Candidato: "${candidate.title}"
                  Tamanho: "${candidate.size}"
                  Seeders: ${candidate.seeders}
                  Origem: "${candidate.sourceName}"
                  
                  Descrição da Página:
                  """
                  ${detailData.description.slice(0, 1000)}
                  """
                  
                  Arquivos contidos no Torrent:
                  """
                  ${detailData.files.join('\n')}
                  """
                  
                  Links Magnet Disponíveis na Página:
                  ${JSON.stringify(magnetsToEvaluate.map(m => ({ index: m.index, linkText: m.linkText, displayName: m.displayName, parentText: m.parentText })), null, 2)}
                  
                  Determine quais dos links magnet correspondem ao conteúdo solicitado pelo usuário.
                  Múltiplos links magnet na página podem representar tanto episódios de séries/animes quanto diferentes qualidades, tamanhos, dublagens, cortes de edição (ex: Director's Cut ou Extended) ou formatos de um filme.
                  Analise cada link de forma independente. Use o campo "displayName" (obtido diretamente do link magnet) e o texto de contexto ao redor do link para identificar o nome e detalhes específicos de cada torrent.
                  
                  Responda APENAS com um objeto JSON no formato exato:
                  {
                    "evaluatedMagnets": [
                      {
                        "index": number,
                        "matches": true/false,
                        "title": "Título específico para este link (ex: 'Rick e Morty - S09E01 - 1080p Dual Áudio')",
                        "type": "series" | "movie" | "book" | "music" | "unknown",
                        "episodesCount": number | "movie" | "unknown",
                        "resolution": "1080p" | "720p" | "480p" | "unknown",
                        "hasPortugueseAudio": true/false,
                        "hasPortugueseSubtitles": true/false,
                        "explanation": "Breve explicação justificando a decisão para este link."
                      }
                    ]
                  }`
                }
              ];
              
              if (token.stopped) throw new Error('SEARCH_STOPPED');
              const evalResult = await callLLM(searchId, evaluationPrompt, true);
              const evaluatedMagnets = evalResult.evaluatedMagnets || [];
              
              let hasSavedAnyMatch = false;
              
              for (const evalItem of evaluatedMagnets) {
                const magnetObj = magnetsToEvaluate[evalItem.index];
                if (!magnetObj) continue;
                
                if (evalItem.matches) {
                  const existingResult = await TorrentResult.findOne({
                    where: {
                      searchId,
                      magnetLink: magnetObj.href
                    }
                  });
                  
                  if (!existingResult) {
                    await logAgent(searchId, `Aprovado link: "${evalItem.title}" de ${candidate.sourceName}. Raciocínio: ${evalItem.explanation}`, 'success');
                    
                    await saveResult(searchId, {
                      title: evalItem.title || candidate.title,
                      magnetLink: magnetObj.href,
                      pageUrl: candidate.pageUrl || '',
                      size: candidate.size,
                      seeders: candidate.seeders,
                      leechers: 0,
                      episodes: String(evalItem.episodesCount),
                      resolution: evalItem.resolution,
                      hasPortugueseAudio: evalItem.hasPortugueseAudio,
                      hasPortugueseSubtitles: evalItem.hasPortugueseSubtitles,
                      explanation: evalItem.explanation,
                      sourceName: candidate.sourceName
                    });
                    
                    hasSavedAnyMatch = true;
                  } else {
                    await logAgent(searchId, `Link já existente pulado: "${evalItem.title}"`, 'info');
                  }
                } else {
                  await logAgent(searchId, `Ignorado link: "${evalItem.title || candidate.title}". Raciocínio: ${evalItem.explanation}`, 'info');
                }
              }
              
              await TorrentEvaluation.create({
                searchId,
                nyaaId: candidate.uniqueId,
                title: candidate.title,
                status: hasSavedAnyMatch ? 'matched' : 'ignored',
                explanation: `Processados ${evaluatedMagnets.length} links magnet na página. ` +
                             (hasSavedAnyMatch ? 'Encontrados links correspondentes.' : 'Nenhum link correspondente encontrado.')
              });
              
              if (hasSavedAnyMatch) {
                const isComplete = await checkSearchCompletion(searchId, search, browser, config, false);
                if (isComplete) {
                  searchCompleted = true;
                  break;
                }
              }
            } catch (err) {
              await logAgent(searchId, `Erro ao processar detalhes de ${candidate.title}: ${err.message}`, 'error');
            }
          }
        }
      } else {
        await logAgent(searchId, `Nenhum torrent encontrado na variação ${variationCount} após escanear todas as fontes selecionadas.`, 'warn');
      }
      
      if (searchCompleted) {
        break;
      }
      
      const isCompleteCheck = await checkSearchCompletion(searchId, search, browser, config, false);
      if (isCompleteCheck) {
        searchCompleted = true;
        break;
      }
      
      variationCount++;
      if (variationCount <= maxVariations) {
        await logAgent(searchId, `Buscando nova variação de termos de pesquisa, pois a variação anterior não preencheu todos os requisitos de busca...`, 'info');
        
        // Busca matches existentes no banco para aplicar a estratégia de sequências/episódios
        const currentMatches = await TorrentResult.findAll({ where: { searchId } });
        const matchTitles = currentMatches.map(r => r.title);
        
        let programmaticKeywords = [];
        if (matchTitles.length > 0) {
          programmaticKeywords = generateNextEpisodeKeywords(matchTitles, attemptedKeywords);
        }
        
        if (programmaticKeywords.length > 0) {
          currentKeywords = programmaticKeywords.slice(0, 2);
          await logAgent(searchId, `Estratégia de episódio/sequência detectada! Geradas palavras-chave automáticas a partir de títulos encontrados: ${currentKeywords.join(', ')}`, 'info');
          
          for (const kw of currentKeywords) {
            if (!attemptedKeywords.includes(kw)) {
              attemptedKeywords.push(kw);
            }
          }
        } else {
          // Caso não haja palavras-chave de sequências programáticas, chama o LLM normal com histórico
          const variationPrompt = [
            {
              role: "system",
              content: "Você é um assistente especialista em torrents. Seu objetivo é ajudar a encontrar o conteúdo desejado gerando variações de palavras-chave de busca eficientes e inteligentes para rastreadores de torrent."
            },
            {
              role: "user",
              content: `O usuário quer encontrar torrents que correspondam a: "${search.query}".
              Idioma Preferido: "${config.preferredLanguage}"
              Resolução Preferida: "${config.preferredResolution}"
              
              Já tentamos realizar buscas com as seguintes palavras-chave, mas elas não resultaram em resultados satisfatórios ou compatíveis:
              ${JSON.stringify(attemptedKeywords)}
              
              ${matchTitles.length > 0 ? `Até agora, encontramos com sucesso os seguintes resultados correspondentes:
              ${JSON.stringify(matchTitles)}
              
              Se esses resultados forem episódios individuais (ex: "E01", "Ep 1", "01"), partes ou volumes, use o padrão de título deles como base para gerar palavras-chave de busca para os outros episódios/partes ausentes (por exemplo, incrementando o número do episódio no título ou gerando variações do nome do episódio/temporada, mantendo o formato do grupo de lançamento ou do título encontrado se for relevante).` : ''}
              
              Gere uma nova variação com 1 ou 2 palavras-chave de busca recomendadas adicionais que aumentem as chances de encontrar o arquivo.
              Diretrizes de Variação:
              1. Uma das variações iniciais ou quando nada for encontrado deve ser estritamente o título limpo da obra (ex: nome do filme ou da série), sem nenhuma adição relacionada a idioma, legenda, dublagem ou resolução (ex: sem "1080p", "dublado", "legendado", "dual audio", etc.).
              2. Se os termos anteriores eram muito específicos (ex: com temporada, episódio, ano ou tags), gere termos mais amplos (ex: apenas o nome limpo do show ou do filme).
              3. Se os termos eram muito gerais, tente adicionar palavras-chave relevantes ou sinônimos comuns do conteúdo.
              4. Tente variações com o título oficial do conteúdo em inglês ou no idioma original (ex: japonês para animes), ou traduções comuns.
              5. Tente abreviações comuns ou remova caracteres especiais/pontuações que possam atrapalhar a pesquisa do indexador.
              6. NUNCA sugira termos que já foram tentados anteriormente.
              
              Responda APENAS com um objeto JSON no formato exato:
              {
                "keywords": ["nova_palavra_chave_1", "nova_palavra_chave_2"]
              }`
            }
          ];
          
          try {
            if (token.stopped) throw new Error('SEARCH_STOPPED');
            const variationResult = await callLLM(searchId, variationPrompt, true);
            const newKeywords = (variationResult.keywords || []).filter(kw => kw && !attemptedKeywords.includes(kw));
            
            if (newKeywords.length === 0) {
              await logAgent(searchId, "IA falhou em sugerir palavras-chave novas e únicas. Tentando termo original limpo e simplificado...", "warn");
              const simplified = search.query
                .replace(/(1080p|720p|480p|legendado|dublado|dual\s*audio|completo|temporada|season|s\d+e\d+|\d+ª\s*temporada)/gi, '')
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              if (simplified && !attemptedKeywords.includes(simplified)) {
                currentKeywords = [simplified];
              } else {
                await logAgent(searchId, "Não há mais variações de busca viáveis para tentar.", "warn");
                break;
              }
            } else {
              currentKeywords = newKeywords;
            }
            
            for (const kw of currentKeywords) {
              if (!attemptedKeywords.includes(kw)) {
                attemptedKeywords.push(kw);
              }
            }
            
          } catch (err) {
            await logAgent(searchId, `Erro ao gerar variação de palavras-chave: ${err.message}`, 'warn');
            break;
          }
        }
      }
    }
    
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    
    if (!searchCompleted) {
      await checkSearchCompletion(searchId, search, browser, config, true);
    }
    
  } catch (err) {
    if (err.message === 'SEARCH_STOPPED' || token.stopped) {
      await logAgent(searchId, "Busca parada com sucesso.", "warn");
    } else {
      await logAgent(searchId, `Ocorreu um erro no agente: ${err.message}`, 'error');
      search.status = 'failed';
      await search.save();
      
      if (global.sseBroadcast) {
        global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'failed' } });
      }
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    activeSearches.delete(searchId);
  }
}

// Verifica se os torrents já encontrados preenchem completamente a busca original
async function checkSearchCompletion(searchId, searchModel, browserInstance, config, forceFinish = false) {
  const currentResults = await TorrentResult.findAll({ where: { searchId } });
  
  if (currentResults.length === 0) {
    if (forceFinish) {
      searchModel.status = 'completed';
      await searchModel.save();
      await logAgent(searchId, "Fim da busca. Nenhum resultado correspondente foi encontrado.", "warn");
      if (global.sseBroadcast) {
        global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'completed' } });
      }
      return true;
    }
    return false;
  }
  
  const resultsData = currentResults.map(r => ({
    title: r.title,
    size: r.size,
    seeders: r.seeders,
    resolution: r.resolution,
    episodes: r.episodes,
    source: r.sourceName,
    hasPortugueseAudio: r.hasPortugueseAudio,
    hasPortugueseSubtitles: r.hasPortugueseSubtitles
  }));
  
  const completionPrompt = [
    {
      role: "system",
      content: "Você é um gerente de qualidade de busca e torrents. Analise se os resultados obtidos até agora satisfazem o termo de pesquisa original do usuário."
    },
    {
      role: "user",
      content: `Consulta do Usuário: "${searchModel.query}"
      Idioma Preferido: "${config.preferredLanguage}"
      Resolução Preferida: "${config.preferredResolution}"
      
      Resultados Correspondentes Encontrados até agora:
      ${JSON.stringify(resultsData, null, 2)}
      
      Responda:
      1. Se for um FILME: Já encontramos o filme correspondente na resolução desejada ou na melhor qualidade disponível?
      2. Se for uma SÉRIE/ANIME: Já encontramos pacotes completos de episódios (ex: "Complete", "01-12") ou episódios individuais suficientes para cobrir toda a temporada?
      3. Se for outro tipo de conteúdo (como livro ou música): Já foi encontrado o item completo?
      4. Com base nas opções encontradas, marque "completed" como true se o objetivo da busca foi alcançado e não precisamos mais procurar.
      5. Qual o tipo de conteúdo ("series", "movie", "book", "music", "unknown")?
      6. Qual a contagem total de episódios estimada (se for série) ou tipo de arquivo?
      
      Responda APENAS com um objeto JSON no formato exato:
      {
        "completed": true/false,
        "type": "series" | "movie" | "book" | "music" | "unknown",
        "estimatedTotalEpisodes": "12" | "movie" | "unknown",
        "explanation": "Uma explicação curta justificando sua decisão."
      }`
    }
  ];
  
  try {
    const checkResult = await callLLM(searchId, completionPrompt, true);
    
    // Atualiza metadados
    searchModel.type = checkResult.type || 'unknown';
    searchModel.episodesCount = String(checkResult.estimatedTotalEpisodes || 'unknown');
    await searchModel.save();
    
    if (global.sseBroadcast) {
      global.sseBroadcast(searchId, { 
        type: 'meta_change', 
        data: { type: searchModel.type, episodesCount: searchModel.episodesCount } 
      });
    }
    
    if (checkResult.completed || forceFinish) {
      searchModel.status = 'completed';
      await searchModel.save();
      
      const statusMsg = checkResult.completed 
        ? `Busca concluída com sucesso! Motivo: ${checkResult.explanation}`
        : `Fim do processo de busca. Todos os candidatos disponíveis foram analisados. Motivo: ${checkResult.explanation}`;
        
      await logAgent(searchId, statusMsg, 'success');
      
      if (global.sseBroadcast) {
        global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'completed' } });
      }
      
      return true;
    } else {
      await logAgent(searchId, `Avaliação de progresso: Ainda faltam arquivos (${checkResult.explanation}). Continuando busca...`, 'info');
      return false;
    }
  } catch (err) {
    console.error("Erro na verificação de conclusão:", err.message);
    if (forceFinish) {
      searchModel.status = 'completed';
      await searchModel.save();
      if (global.sseBroadcast) {
        global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'completed' } });
      }
      return true;
    }
    return false;
  }
}

// Helper para gerar palavras-chave para próximos episódios ou sequências com base nos matches já encontrados
function generateNextEpisodeKeywords(matchedTitles, attemptedKeywords) {
  const nextKeywords = [];
  
  const regexes = [
    /(\bs\d+e)(\d+)\b/i,                                      // S01E01 -> prefix="S01E", num="01"
    /(\bep(?:isódio|isode)?\s*|cap(?:ítulo)?\s*|e\s*)(\d+)\b/i, // Ep 01 -> prefix="Ep ", num="01"
    /(\bpart(?:e)?\s*|vol(?:ume)?\s*)(\d+)\b/i                // Part 1, Vol 1 -> prefix="Part ", num="1"
  ];
  
  for (const title of matchedTitles) {
    for (const regex of regexes) {
      const match = title.match(regex);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const num = parseInt(numStr, 10);
        
        if (!isNaN(num) && num > 0) {
          // Ignora anos normais (ex: 1990-2030) para não gerar buscas por anos incrementados
          if (num >= 1990 && num <= 2030) {
            continue;
          }
          
          // Tenta gerar os próximos 3 episódios/partes
          for (let i = 1; i <= 3; i++) {
            const nextNum = num + i;
            const nextNumStr = numStr.startsWith('0') && numStr.length > 1 && nextNum < 10
              ? '0' + nextNum 
              : String(nextNum);
              
            // Substitui a numeração no título original do torrent correspondente encontrado
            const newTitleKeyword = title.replace(match[0], prefix + nextNumStr);
            
            // Gera também uma versão simplificada: Nome do show + prefixo + número (ex: "Show Name S01E02")
            const titleIndex = title.indexOf(match[0]);
            let cleanShowName = title;
            if (titleIndex !== -1) {
              cleanShowName = title.substring(0, titleIndex)
                .replace(/[\[\({].*?[\]\)}]/g, '') // remove tags e colchetes
                .replace(/[^a-zA-Z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }
            
            const simpleKeyword = `${cleanShowName} ${prefix}${nextNumStr}`.replace(/\s+/g, ' ').trim();
            
            if (simpleKeyword && !attemptedKeywords.includes(simpleKeyword) && !nextKeywords.includes(simpleKeyword)) {
              nextKeywords.push(simpleKeyword);
            }
            if (newTitleKeyword && !attemptedKeywords.includes(newTitleKeyword) && !nextKeywords.includes(newTitleKeyword)) {
              nextKeywords.push(newTitleKeyword);
            }
          }
        }
        break; // Só analisa o primeiro padrão encontrado para cada título
      }
    }
  }
  return nextKeywords;
}

// Testa a conexão com a API de IA
async function testConnection(config) {
  try {
    let endpoint = '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};
    
    const messages = [{ role: 'user', content: 'respond only with "ok"' }];
    
    if (config.aiProvider === 'anthropic') {
      endpoint = config.aiUrl.endsWith('/messages') 
        ? config.aiUrl 
        : (config.aiUrl.endsWith('/v1') ? `${config.aiUrl}/messages` : `${config.aiUrl}/v1/messages`);
        
      headers['x-api-key'] = config.aiToken;
      headers['anthropic-version'] = '2023-06-01';
      
      body = {
        model: config.aiModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'respond only with "ok"' }]
      };
    } else {
      endpoint = config.aiUrl.endsWith('/chat/completions') 
        ? config.aiUrl 
        : (config.aiUrl.endsWith('/v1') ? `${config.aiUrl}/chat/completions` : `${config.aiUrl}/v1/chat/completions`);
        
      headers['Authorization'] = `Bearer ${config.aiToken}`;
      
      body = {
        model: config.aiModel,
        messages: messages,
        max_tokens: 10
      };
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API respondeu com erro ${response.status}: ${errorText}`
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}

// Analisa a melhor estratégia de busca de um site
async function analyzeSearchSource(sourceId) {
  const source = await SearchSource.findByPk(sourceId);
  if (!source) {
    throw new Error(`Fonte de busca #${sourceId} não encontrada.`);
  }

  // Cancela análise anterior se houver
  if (activeOptimizations.has(sourceId)) {
    const prev = activeOptimizations.get(sourceId);
    prev.aborted = true;
    if (prev.browser) {
      try { await prev.browser.close(); } catch (e) {}
    }
  }

  const optState = { browser: null, aborted: false };
  activeOptimizations.set(sourceId, optState);

  const log = (msg) => {
    console.log(`[Otimizador de Site] [${source.name}] ${msg}`);
    analysisEvents.emit('log', { sourceId, message: msg });
  };

  const checkAborted = () => {
    if (optState.aborted) {
      throw new Error("Análise cancelada pelo usuário.");
    }
  };

  let browser = null;
  try {
    log(`Iniciando análise do site: ${source.name} (${source.url})`);
    
    log("Abrindo navegador Chrome/Puppeteer isolado...");
    checkAborted();
    browser = await launchBrowserWithRetry(null);
    optState.browser = browser;
    checkAborted();

    const page = await browser.newPage();
    
    // Configura disfarce humano na página
    await preparePageForHumanLikeBehavior(page);
    
    log(`Navegando até a URL base: ${source.url}...`);
    checkAborted();
    
    // Usa domcontentloaded para evitar timeouts com scripts de rastreamento pesados/lentos
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    checkAborted();
    
    log("Aguardando carregamento inicial e hidratação da página...");
    await new Promise(r => setTimeout(r, 2000));
    checkAborted();

    log("Simulando comportamento humano (movimentos de mouse e scroll)...");
    await simulateHumanInteraction(page);
    checkAborted();

    // Detecção ativa de Cloudflare
    const pageTitle = await page.title();
    if (pageTitle.includes('Cloudflare') || pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
      log("Alerta: Desafio/CAPTCHA do Cloudflare detectado! Aguardando 8 segundos para resolução automática...");
      await new Promise(r => setTimeout(r, 8000));
      checkAborted();
      const pageTitleRetry = await page.title();
      if (pageTitleRetry.includes('Cloudflare') || pageTitleRetry.includes('Just a moment')) {
        throw new Error("Acesso bloqueado pela proteção contra bots do Cloudflare (desafio automático falhou).");
      }
      log("Sucesso: Desafio de segurança do Cloudflare superado!");
    }

    log("Acessado com sucesso. Avaliando estrutura da página (DOM)...");
    
    // Avalia a estrutura da página
    const pageData = await page.evaluate(() => {
      const title = document.title;
      
      // Mapeia os formulários presentes
      const forms = Array.from(document.querySelectorAll('form')).map(form => {
        const action = form.getAttribute('action') || '';
        const method = (form.getAttribute('method') || 'get').toLowerCase();
        const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => {
          return {
            name: input.getAttribute('name') || '',
            type: input.getAttribute('type') || input.tagName.toLowerCase(),
            placeholder: input.getAttribute('placeholder') || ''
          };
        });
        return { action, method, inputs };
      });

      // Mapeia inputs de busca fora de formulários
      const searchInputs = Array.from(document.querySelectorAll('input')).filter(input => {
        const name = (input.getAttribute('name') || '').toLowerCase();
        const id = (input.getAttribute('id') || '').toLowerCase();
        const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
        const type = (input.getAttribute('type') || '').toLowerCase();
        return name.includes('search') || name.includes('query') || name.includes('q') || 
               id.includes('search') || placeholder.includes('buscar') || placeholder.includes('search') ||
               type === 'search';
      }).map(input => ({
        name: input.getAttribute('name') || '',
        type: input.getAttribute('type') || 'input',
        placeholder: input.getAttribute('placeholder') || '',
        id: input.getAttribute('id') || ''
      }));

      // Pega alguns links relevantes para tentar achar padrões de URLs de busca
      const links = Array.from(document.querySelectorAll('a'))
        .map(a => ({
          text: a.innerText.trim(),
          href: a.getAttribute('href') || ''
        }))
        .filter(link => {
          const href = link.href.toLowerCase();
          return href.includes('search') || href.includes('query') || href.includes('q=') || href.includes('search=') || href.includes('api/');
        })
        .slice(0, 20);

      return { title, forms, searchInputs, links };
    });

    log(`Título da página localizado: "${pageData.title}"`);
    log(`Encontrados ${pageData.forms.length} formulários e ${pageData.searchInputs.length} inputs de busca.`);

    // --- Simulação de Busca Ativa ---
    log("Procurando campo de busca (input) na página para simulação...");
    const searchSelector = await page.evaluate(() => {
      const candidates = [
        'input[type="search"]',
        'input[name="q"]',
        'input[name="query"]',
        'input[name="search"]',
        'input[name="searchTerm"]',
        'input[name="search_query"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="buscar" i]',
        'input[id*="search" i]',
        'input[class*="search" i]'
      ];
      for (const selector of candidates) {
        try {
          const el = document.querySelector(selector);
          if (el && el.tagName === 'INPUT') {
            return selector;
          }
        } catch (e) {}
      }
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const input of inputs) {
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        if (['text', 'search'].includes(type)) {
          const id = input.id ? `#${input.id}` : '';
          const name = input.name ? `[name="${input.name}"]` : '';
          if (id || name) return `input${id}${name}`;
        }
      }
      return null;
    });

    let activeSearchDiscovery = null;
    let capturedRequestUrl = null;

    if (searchSelector) {
      log(`Campo de busca localizado: ${searchSelector}`);
      
      // Habilita listener para requisições AJAX durante a busca
      page.on('request', request => {
        const url = request.url();
        if (url.includes('testquery123') && !url.endsWith('.png') && !url.endsWith('.jpg') && !url.endsWith('.css') && !url.endsWith('.js')) {
          capturedRequestUrl = url;
          log(`Capturado padrão de busca via chamada AJAX: ${url}`);
        }
      });

      log("Inserindo o termo de teste 'testquery123'...");
      checkAborted();
      await page.focus(searchSelector);
      
      // Limpa o campo de busca
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      
      await page.type(searchSelector, 'testquery123');
      checkAborted();
      
      log("Pressionando ENTER para submeter a busca...");
      await page.keyboard.press('Enter');
      
      log("Aguardando redirecionamento ou chamadas AJAX...");
      try {
        await page.waitForNavigation({ timeout: 6000 }).catch(() => {});
      } catch (e) {}
      
      checkAborted();
      const finalUrl = page.url();
      log(`URL da página após busca: ${finalUrl}`);
      
      if (finalUrl && finalUrl.includes('testquery123')) {
        activeSearchDiscovery = finalUrl.replace('testquery123', '{query}');
        log(`Padrão de URL de busca encontrado via redirecionamento: ${activeSearchDiscovery}`);
      } else if (capturedRequestUrl) {
        activeSearchDiscovery = capturedRequestUrl.replace('testquery123', '{query}');
        log(`Padrão de busca AJAX/API capturado: ${activeSearchDiscovery}`);
      } else {
        log("Nenhum padrão dinâmico imediato pôde ser deduzido pela simulação.");
      }
    } else {
      log("Nenhum campo de entrada de texto para busca pôde ser identificado.");
    }

    log("Fechando navegador de análise...");
    await browser.close();
    browser = null;
    optState.browser = null;

    log("Enviando dados estruturais coletados ao cérebro da IA...");
    checkAborted();

    // Constrói prompt para a IA definir a melhor estratégia
    const parsePrompt = [
      {
        role: "system",
        content: "Você é um especialista em análise de arquitetura web de sites de torrent, crawlers e engenharia de busca."
      },
      {
        role: "user",
        content: `Estamos analisando o site "${source.name}" com URL base "${source.url}".
A estratégia/padrão de busca atual é: "${source.searchUrlPattern}".

Acessamos a página inicial e coletamos as seguintes informações sobre a estrutura da página:
${JSON.stringify(pageData, null, 2)}

${activeSearchDiscovery ? `Durante a simulação de busca digitando 'testquery123' no campo de busca, detectamos que o site gerou/redirecionou para a seguinte URL ou rota de API: "${activeSearchDiscovery}". Utilize essa informação como altíssima prioridade para determinar o "detectedPattern"!` : ''}

Analise se existe uma estratégia melhor para realizar pesquisas automatizadas de torrent neste site.
Considere:
1. Se há um formulário de busca com método GET (geralmente gerando um padrão de URL como https://domain.com/search?q={query}).
2. Se o padrão atual já está correto ou se há um melhor/mais limpo.
3. Se há alguma indicação de API de busca.
4. Se o site requer navegação complexa (ex: SPA).

Responda em formato JSON, com as seguintes chaves:
- "success": true/false (se a análise foi bem-sucedida)
- "strategyType": "query_url" ou "api_route" ou "input_selector" ou "unknown"
- "detectedPattern": o padrão de URL de busca ideal contendo "{query}" (ex: "https://site.com/search?q={query}"). Se for para manter a atual, retorne ela mesma. Garanta que seja uma URL válida e completa (incluindo o domínio se for relativo).
- "explanation": breve explicação em Português sobre o que foi encontrado e a lógica da recomendação.
- "optimizedDescription": descrição do site em Português resumida (máximo 150 caracteres), focando em que tipo de conteúdo ele suporta, ajudando a IA principal a decidir quando usá-lo.
- "contentTypes": array contendo os tipos de conteúdo recomendados baseados no site e análise (ex: ["movies", "series", "book", "music", "other"])

Responda APENAS com o objeto JSON válido, sem qualquer bloco de código markdown ou texto extra.`
      }
    ];

    const parseResult = await callLLM(null, parsePrompt, true);
    log(`Análise de IA concluída com sucesso! Nova estratégia proposta: ${parseResult.detectedPattern}`);
    
    return {
      success: true,
      analysis: parseResult
    };

  } catch (err) {
    log(`Falha na análise: ${err.message}`);
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
    
    let errorMsg = err.message || String(err);
    let isConnectionError = false;
    if (errorMsg.includes('timeout') || errorMsg.includes('Navigation') || errorMsg.includes('net::ERR')) {
      errorMsg = 'Tempo limite de conexão esgotado (Timeout). O site pode estar offline, bloqueado pelo provedor ou sob proteção do Cloudflare.';
      isConnectionError = true;
    }
    
    return {
      success: false,
      isConnectionError: isConnectionError,
      error: errorMsg
    };
  } finally {
    activeOptimizations.delete(sourceId);
  }
}

// Cancela a análise em andamento de uma fonte
async function cancelSearchSourceAnalysis(sourceId) {
  const optState = activeOptimizations.get(sourceId);
  if (optState) {
    optState.aborted = true;
    if (optState.browser) {
      try {
        await optState.browser.close();
      } catch (err) {
        // Ignora erros ao fechar
      }
    }
    activeOptimizations.delete(sourceId);
    console.log(`[Otimizador de Site] Análise da fonte #${sourceId} cancelada com sucesso.`);
    return { success: true };
  }
  return { success: false, error: "Nenhuma análise ativa para esta fonte." };
}

module.exports = {
  enqueueSearch,
  stopSearchAgent,
  testConnection,
  analyzeSearchSource,
  cancelSearchSourceAnalysis,
  analysisEvents
};
