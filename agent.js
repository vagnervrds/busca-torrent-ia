const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Search, TorrentResult, TorrentEvaluation, AgentLog, SystemSetting, SearchSource } = require('./database');

// Habilita o plugin stealth para evitar detecção de robô
puppeteer.use(StealthPlugin());

// Mapa para controle de buscas ativas em memória (cancelamento imediato)
const activeSearches = new Map(); // searchId -> { token: { stopped: false }, browser: Browser }

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

// Helper para logs com SSE
async function logAgent(searchId, message, level = 'info') {
  console.log(`[Busca #${searchId}] [${level.toUpperCase()}] ${message}`);
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

// Helper de chamada do LLM híbrido (OpenAI ou Anthropic)
async function callLLM(messages, jsonMode = false) {
  const config = await getSettings();
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      console.error(`Erro ao chamar LLM (${config.aiProvider}, tentativa ${attempt}/${maxRetries}):`, err.message);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// Interrompe uma busca ativa
async function stopSearchAgent(searchId) {
  const search = await Search.findByPk(searchId);
  if (search && search.status === 'searching') {
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
    const sourceSelectionResult = await callLLM(selectSourcesPrompt, true);
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
    const keywordsResult = await callLLM(keywordAnalysisPrompt, true);
    const keywords = keywordsResult.keywords || [search.query];
    await logAgent(searchId, `Palavras-chave geradas pela IA: ${keywords.join(', ')}`, 'info');
    
    // Inicializa o Puppeteer
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1366,768'
      ]
    });
    
    const active = activeSearches.get(searchId);
    if (active) active.browser = browser;
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setJavaScriptEnabled(false); // Evita execução de scripts pesados/anúncios/mineradores
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="120", "Not=A?Brand";v="24", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Lista para acumular torrents candidatos coletados
    let allScrapedTorrents = [];
    
    // Carrega o histórico de avaliações do DB para esta busca
    const existingEvaluations = await TorrentEvaluation.findAll({ where: { searchId } });
    const evaluatedMap = new Map(existingEvaluations.map(e => [e.nyaaId, e.status]));
    
    // Loop pelas fontes e palavras-chave
    for (const source of selectedSources) {
      const isNyaa = source.name.toLowerCase().includes('nyaa') || source.url.includes('nyaa.si');
      
      for (const keyword of keywords) {
        if (token.stopped) throw new Error('SEARCH_STOPPED');
        await logAgent(searchId, `Pesquisando no site "${source.name}" por: "${keyword}"...`, 'info');
        
        // Substitui {query} no padrão da URL de busca
        const searchUrl = source.searchUrlPattern.replace('{query}', encodeURIComponent(keyword));
        
        try {
          await page.goto(searchUrl, { waitUntil: 'load', timeout: 15000 });
          
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
              const parseResult = await callLLM(parsePrompt, true);
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
    
    if (uniqueTorrents.length === 0) {
      await logAgent(searchId, "Nenhum torrent encontrado após escanear todas as fontes selecionadas.", "warn");
      search.status = 'completed';
      await search.save();
      await browser.close();
      activeSearches.delete(searchId);
      if (global.sseBroadcast) {
        global.sseBroadcast(searchId, { type: 'status_change', data: { status: 'completed' } });
      }
      return;
    }
    
    // Filtra torrents já avaliados historicamente nesta busca
    const pendingTorrents = uniqueTorrents.filter(torrent => {
      const torrentId = torrent.magnetLink || torrent.pageUrl;
      // Usaremos o hash do link magnet ou o ID final da URL como nyaaId
      const uniqueId = torrent.magnetLink 
        ? torrent.magnetLink.split('btih:')[1]?.split('&')[0] || torrentId 
        : torrent.pageUrl.split('/').pop() || torrentId;
        
      torrent.uniqueId = uniqueId; // guarda para uso posterior
      return !evaluatedMap.has(uniqueId);
    });
    
    await logAgent(searchId, `Filtro concluído: ${uniqueTorrents.length} torrents totais, ${pendingTorrents.length} novos para analisar com IA.`, 'info');
    
    if (pendingTorrents.length === 0) {
      await logAgent(searchId, "Todos os torrents encontrados nesta página já foram avaliados anteriormente.", "info");
      await checkSearchCompletion(searchId, search, browser, config);
      return;
    }
    
    // Passo 3: Filtro Inicial por IA (selecionar melhores títulos para poupar requisições e processamento de páginas)
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
        const filterResult = await callLLM(filterPrompt, true);
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
    
    await logAgent(searchId, `IA selecionou ${candidatesToInspect.length} candidatos para inspeção profunda de detalhes.`, 'info');
    
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
        
        // Se a página de detalhes existe, navega até ela. Caso contrário, avalia apenas o título (se o magnet já veio na busca)
        if (candidate.pageUrl) {
          let targetUrl = candidate.pageUrl;
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            try {
              targetUrl = new URL(targetUrl, source.url).href;
            } catch (e) {
              await logAgent(searchId, `Ignorando URL de detalhes inválida para "${candidate.title}": ${candidate.pageUrl}`, 'warn');
              continue;
            }
          }
          await page.goto(targetUrl, { waitUntil: 'load', timeout: 15000 });
          
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
        
        // Define a lista de links magnet para avaliar
        let magnetsToEvaluate = detailData.extractedMagnets || [];
        
        // Fallback para o magnet da página de busca caso nenhum tenha sido extraído na página de detalhes
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
        
        // Pergunta à IA se os magnets atendem à busca
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
        const evalResult = await callLLM(evaluationPrompt, true);
        const evaluatedMagnets = evalResult.evaluatedMagnets || [];
        
        let hasSavedAnyMatch = false;
        
        for (const evalItem of evaluatedMagnets) {
          const magnetObj = magnetsToEvaluate[evalItem.index];
          if (!magnetObj) continue;
          
          if (evalItem.matches) {
            // Verifica duplicidade do link magnet antes de salvar
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
                leechers: candidate.leechers || 0,
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
        
        // Salva a avaliação da página mãe no histórico
        await TorrentEvaluation.create({
          searchId,
          nyaaId: candidate.uniqueId,
          title: candidate.title,
          status: hasSavedAnyMatch ? 'matched' : 'ignored',
          explanation: `Processados ${evaluatedMagnets.length} links magnet na página. ` +
                       (hasSavedAnyMatch ? 'Encontrados links correspondentes.' : 'Nenhum link correspondente encontrado.')
        });
        
        // Verifica se já concluímos a busca se salvamos algum resultado novo
        if (hasSavedAnyMatch) {
          const isComplete = await checkSearchCompletion(searchId, search, browser, config);
          if (isComplete) return;
        }
        
      } catch (err) {
        await logAgent(searchId, `Erro ao processar detalhes de ${candidate.title}: ${err.message}`, 'error');
      }
    }
    
    if (token.stopped) throw new Error('SEARCH_STOPPED');
    await checkSearchCompletion(searchId, search, browser, config, true);
    
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
    const active = activeSearches.get(searchId);
    if (active && active.browser) {
      try {
        await active.browser.close();
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
      try { await browserInstance.close(); } catch(e){}
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
    const checkResult = await callLLM(completionPrompt, true);
    
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
      
      try {
        await browserInstance.close();
      } catch (e) {}
      
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
      try { await browserInstance.close(); } catch(e){}
      return true;
    }
    return false;
  }
}

module.exports = {
  runSearchAgent,
  stopSearchAgent
};
