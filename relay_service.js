/**
 * relay_service.js
 * Serviço de integração com o Servidor Proxy Relay & Túnel HTTP Seguro (OAuth & Webhooks).
 * Permite que o Busca Torrent IA se conecte ao servidor de Relay via SSE e receba comandos
 * remotos enviados por clientes externos (como o hunter_cli em Python) sem necessidade de
 * abrir portas ou configurar DDNS.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { SystemSetting, Search, TorrentResult, TorrentEvaluation, AgentLog } = require('./database');
const { enqueueSearch, stopSearchAgent, testConnection } = require('./agent');
const { DelugeClient } = require('./gerenciar_deluge');
const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');

class RelayService {
  constructor() {
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'
    this.lastError = null;
    this.lastConnectedAt = null;
    this.eventsReceivedCount = 0;
    this.lastEventAt = null;
    this.lastEventData = null;
    this.recentEvents = []; // Guarda os últimos 20 eventos para inspeção na UI
    this.activeSseReq = null;
    this.reconnectTimeout = null;
    this.shouldRun = false;

    // Configurações em memória
    this.config = {
      enabled: false,
      serverUrl: 'https://relay.exemplo.com',
      accessToken: '',
      uid: 'hunter_torrent_local',
      targetUrl: 'http://localhost:4182',
      description: 'Agente Busca Torrent IA'
    };
  }

  /**
   * Inicializa o serviço carregando configurações do SQLite e iniciando se estiver ativo
   */
  async init() {
    try {
      await this.loadConfig();
      if (this.config.enabled) {
        console.log('[RelayService] Túnel Relay está habilitado nas configurações. Iniciando conexão...');
        this.start();
      } else {
        console.log('[RelayService] Túnel Relay desabilitado.');
      }
    } catch (err) {
      console.error('[RelayService] Erro ao inicializar RelayService:', err.message);
    }
  }

  /**
   * Carrega configurações de SystemSetting
   */
  async loadConfig() {
    try {
      const dbSettings = await SystemSetting.findAll();
      const map = {};
      dbSettings.forEach(s => {
        map[s.key] = s.value;
      });

      this.config.enabled = map.relay_enabled === 'true';
      this.config.serverUrl = (map.relay_server_url || 'https://relay.exemplo.com').trim().replace(/\/+$/, '');
      this.config.accessToken = (map.relay_access_token || '').trim();
      this.config.uid = (map.relay_uid || 'hunter_torrent_local').trim();
      this.config.targetUrl = (map.relay_target_url || 'http://localhost:4182').trim().replace(/\/+$/, '');
      this.config.description = (map.relay_description || 'Agente Busca Torrent IA').trim();

      return this.config;
    } catch (err) {
      console.error('[RelayService] Erro ao carregar configurações do banco:', err.message);
      return this.config;
    }
  }

  /**
   * Salva configurações no SystemSetting
   */
  async saveConfig(newConfig) {
    if (newConfig.enabled !== undefined) this.config.enabled = Boolean(newConfig.enabled);
    if (newConfig.serverUrl !== undefined) this.config.serverUrl = String(newConfig.serverUrl).trim().replace(/\/+$/, '');
    if (newConfig.accessToken !== undefined) this.config.accessToken = String(newConfig.accessToken).trim();
    if (newConfig.uid !== undefined) this.config.uid = String(newConfig.uid).trim();
    if (newConfig.targetUrl !== undefined) this.config.targetUrl = String(newConfig.targetUrl).trim().replace(/\/+$/, '');
    if (newConfig.description !== undefined) this.config.description = String(newConfig.description).trim();

    await SystemSetting.upsert({ key: 'relay_enabled', value: String(this.config.enabled) });
    await SystemSetting.upsert({ key: 'relay_server_url', value: this.config.serverUrl });
    await SystemSetting.upsert({ key: 'relay_access_token', value: this.config.accessToken });
    await SystemSetting.upsert({ key: 'relay_uid', value: this.config.uid });
    await SystemSetting.upsert({ key: 'relay_target_url', value: this.config.targetUrl });
    await SystemSetting.upsert({ key: 'relay_description', value: this.config.description });

    if (this.config.enabled) {
      this.start();
    } else {
      this.stop();
    }

    return this.getStatus();
  }

  /**
   * Obtém o status operacional completo
   */
  getStatus() {
    return {
      status: this.status,
      enabled: this.config.enabled,
      serverUrl: this.config.serverUrl,
      uid: this.config.uid,
      targetUrl: this.config.targetUrl,
      hasToken: Boolean(this.config.accessToken && this.config.accessToken.length > 5),
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt,
      eventsReceivedCount: this.eventsReceivedCount,
      lastEventAt: this.lastEventAt,
      lastEventData: this.lastEventData,
      recentEvents: this.recentEvents.slice(0, 10),
      endpoints: {
        register: `${this.config.serverUrl}/relay/register`,
        webhook_ingest: `${this.config.serverUrl}/relay/${this.config.uid}/webhook`,
        events_sse: `${this.config.serverUrl}/relay/${this.config.uid}/events`,
        poll_webhooks: `${this.config.serverUrl}/relay/${this.config.uid}/poll`
      }
    };
  }

  /**
   * Inicia o túnel (registro + conexão SSE)
   */
  async start() {
    this.shouldRun = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    await this._connectCycle();
  }

  /**
   * Para o túnel e encerra conexões ativas
   */
  stop() {
    this.shouldRun = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.activeSseReq) {
      try {
        this.activeSseReq.destroy();
      } catch (e) {
        // Ignora
      }
      this.activeSseReq = null;
    }
    this.status = 'disconnected';
    console.log('[RelayService] Túnel Relay desconectado.');
  }

  /**
   * Testa a comunicação com o servidor Relay sem salvar
   */
  async testConnection(serverUrl, token, uid) {
    const url = (serverUrl || this.config.serverUrl).replace(/\/+$/, '');
    const tok = token || this.config.accessToken;
    const testUid = uid || this.config.uid;

    if (!url || url.includes('exemplo.com')) {
      return { success: false, error: 'Forneça uma URL de servidor Relay válida (não genérica).' };
    }
    if (!tok) {
      return { success: false, error: 'Token de acesso Bearer não configurado.' };
    }

    try {
      const tunnelsRes = await this._httpRequest(`${url}/relay/tunnels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tok}`
        },
        timeout: 8000
      });

      if (tunnelsRes.statusCode === 200) {
        const body = JSON.parse(tunnelsRes.body);
        const myTunnel = body.tuneis ? body.tuneis.find(t => t.uid === testUid) : null;
        return {
          success: true,
          message: 'Conexão com Servidor Relay bem-sucedida!',
          tunnelFound: Boolean(myTunnel),
          tunnel: myTunnel,
          totalTunnels: body.tuneis ? body.tuneis.length : 0
        };
      } else {
        return {
          success: false,
          error: `Servidor Relay retornou status HTTP ${tunnelsRes.statusCode}: ${tunnelsRes.body}`
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Falha ao alcançar servidor Relay: ${err.message}`
      };
    }
  }

  /**
   * Ciclo interno de conexão
   */
  async _connectCycle() {
    if (!this.shouldRun) return;

    if (!this.config.serverUrl || this.config.serverUrl.includes('exemplo.com')) {
      this.status = 'error';
      this.lastError = 'URL do Relay configurada como genérica/exemplo. Configure a URL real do servidor.';
      return;
    }

    if (!this.config.accessToken) {
      this.status = 'error';
      this.lastError = 'Token de acesso Bearer ausente.';
      return;
    }

    this.status = 'connecting';
    this.lastError = null;

    try {
      // 1. Registra o UID no servidor Relay
      console.log(`[RelayService] Registrando túnel '${this.config.uid}' em ${this.config.serverUrl}...`);
      const regSuccess = await this._registerTunnel();

      if (!regSuccess) {
        this._scheduleReconnect(8000);
        return;
      }

      // 2. Abre conexão SSE
      this._openSseStream();
    } catch (err) {
      console.error('[RelayService] Erro durante ciclo de conexão:', err.message);
      this.status = 'error';
      this.lastError = err.message;
      this._scheduleReconnect(10000);
    }
  }

  /**
   * Envia requisição de registro para POST /relay/register
   */
  async _registerTunnel() {
    try {
      const payload = {
        uid: this.config.uid,
        target_url: this.config.targetUrl,
        descricao: this.config.description
      };

      const res = await this._httpRequest(`${this.config.serverUrl}/relay/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log(`[RelayService] Túnel '${this.config.uid}' registrado no servidor com sucesso!`);
        return true;
      } else {
        const errMsg = `Falha ao registrar túnel (HTTP ${res.statusCode}): ${res.body}`;
        console.error(`[RelayService] ${errMsg}`);
        this.lastError = errMsg;
        this.status = 'error';
        return false;
      }
    } catch (err) {
      const errMsg = `Erro ao comunicar registro com o Relay: ${err.message}`;
      console.error(`[RelayService] ${errMsg}`);
      this.lastError = errMsg;
      this.status = 'error';
      return false;
    }
  }

  /**
   * Abre conexão contínua SSE com o endpoint /relay/<uid>/events
   */
  _openSseStream() {
    if (!this.shouldRun) return;

    const streamUrlStr = `${this.config.serverUrl}/relay/${this.config.uid}/events?token=${encodeURIComponent(this.config.accessToken)}`;
    console.log(`[RelayService] Conectando ao canal SSE: ${this.config.serverUrl}/relay/${this.config.uid}/events...`);

    try {
      const parsedUrl = new URL(streamUrlStr);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      };

      const req = transport.request(options, (res) => {
        if (res.statusCode !== 200) {
          let errBody = '';
          res.on('data', chunk => errBody += chunk);
          res.on('end', () => {
            const msg = `Servidor Relay rejeitou SSE (HTTP ${res.statusCode}): ${errBody}`;
            console.error(`[RelayService] ${msg}`);
            this.status = 'error';
            this.lastError = msg;
            this._scheduleReconnect(8000);
          });
          return;
        }

        this.status = 'connected';
        this.lastConnectedAt = new Date().toISOString();
        this.lastError = null;
        console.log(`[RelayService] Conexão SSE estabelecida com sucesso! Escutando comandos remotos em tempo real...`);

        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');

          while (buffer.includes('\n\n')) {
            const splitIdx = buffer.indexOf('\n\n');
            const message = buffer.slice(0, splitIdx).trim();
            buffer = buffer.slice(splitIdx + 2);

            if (!message) continue;

            this._handleSseMessage(message);
          }
        });

        res.on('end', () => {
          console.log('[RelayService] Conexão SSE encerrada pelo servidor.');
          this.activeSseReq = null;
          if (this.shouldRun) {
            this.status = 'reconnecting';
            this._scheduleReconnect(3000);
          }
        });

        res.on('error', (err) => {
          console.error('[RelayService] Erro na transmissão do stream SSE:', err.message);
          this.activeSseReq = null;
          if (this.shouldRun) {
            this.status = 'reconnecting';
            this.lastError = err.message;
            this._scheduleReconnect(4000);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[RelayService] Erro ao conectar ao stream SSE:', err.message);
        this.activeSseReq = null;
        if (this.shouldRun) {
          this.status = 'reconnecting';
          this.lastError = err.message;
          this._scheduleReconnect(5000);
        }
      });

      req.setTimeout(60000, () => {
        // Keep-alive timeout — se não receber nada por 60s, recria a conexão
        console.log('[RelayService] Timeout de inatividade SSE. Reiniciando conexão...');
        req.destroy();
      });

      this.activeSseReq = req;
      req.end();
    } catch (err) {
      console.error('[RelayService] Falha ao instanciar conexão SSE:', err.message);
      this.status = 'error';
      this.lastError = err.message;
      this._scheduleReconnect(6000);
    }
  }

  /**
   * Processa uma mensagem individual SSE
   */
  _handleSseMessage(rawMessage) {
    const lines = rawMessage.split('\n');
    let eventType = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        dataStr = line.replace('data:', '').trim();
      }
    }

    if (eventType === 'connected') {
      console.log(`[RelayService] Confirmação de conexão recebida do Relay.`);
      return;
    }

    if (eventType === 'webhook' && dataStr) {
      try {
        const payload = JSON.parse(dataStr);
        this._dispatchIncomingEvent(payload);
      } catch (err) {
        console.error('[RelayService] Erro ao decodificar JSON do evento webhook:', err.message);
      }
    }
  }

  /**
   * Despacha o evento de webhook recebido para o executor de comandos
   */
  async _dispatchIncomingEvent(event) {
    this.eventsReceivedCount++;
    this.lastEventAt = new Date().toISOString();
    this.lastEventData = event;

    // Registra no histórico recente
    this.recentEvents.unshift({
      id: event.id || `evt_${Date.now()}`,
      timestamp: this.lastEventAt,
      method: event.method || 'POST',
      subpath: event.subpath || '',
      bodySummary: typeof event.body === 'object' ? JSON.stringify(event.body).slice(0, 100) : String(event.body || '').slice(0, 100)
    });
    if (this.recentEvents.length > 20) this.recentEvents.pop();

    console.log(`[RelayService] Webhook recebido [ID: ${event.id}, Subpath: ${event.subpath}]:`, event.body);

    const body = event.body || {};
    const command = typeof body === 'object' ? body : {};
    const action = command.action || event.subpath || 'unknown';
    const commandId = command.command_id || event.id;
    const replyUid = command.reply_uid || command.reply_to || null;

    let result = null;

    try {
      switch (action) {
        case 'ping':
          result = { pong: true, serverTime: new Date().toISOString(), agent: 'Busca Torrent IA' };
          break;

        case 'add_torrent':
        case 'add_magnet':
          result = await this._cmdAddTorrent(command.params || command);
          break;

        case 'add_url':
          result = await this._cmdAddUrl(command.params || command);
          break;

        case 'get_torrents':
        case 'torrents_status':
        case 'status':
          result = await this._cmdGetTorrents();
          break;

        case 'pause_torrent':
          result = await this._cmdPauseTorrent(command.params || command);
          break;

        case 'resume_torrent':
          result = await this._cmdResumeTorrent(command.params || command);
          break;

        case 'remove_torrent':
          result = await this._cmdRemoveTorrent(command.params || command);
          break;

        case 'search_ia':
        case 'new_search':
          result = await this._cmdNewSearch(command.params || command);
          break;

        case 'get_searches':
        case 'list_searches':
          result = await this._cmdGetSearches(command.params || command);
          break;

        case 'get_search':
        case 'search_detail':
          result = await this._cmdGetSearchDetail(command.params || command);
          break;

        case 'stop_search':
          result = await this._cmdStopSearch(command.params || command);
          break;

        case 'restart_search':
          result = await this._cmdRestartSearch(command.params || command);
          break;

        case 'get_settings':
          result = await this._cmdGetSettings();
          break;

        case 'save_settings':
        case 'set_settings':
          result = await this._cmdSaveSettings(command.params || command);
          break;

        case 'test_ai':
          result = await this._cmdTestAi(command.params || command);
          break;

        default:
          result = {
            success: false,
            error: `Ação desconhecida: '${action}'. Comandos suportados: add_torrent, get_torrents, search_ia, get_searches, get_settings, save_settings, test_ai, ping.`
          };
      }
    } catch (cmdErr) {
      console.error(`[RelayService] Erro ao executar comando '${action}':`, cmdErr.message);
      result = { success: false, error: cmdErr.message };
    }

    // Se houver um canal de resposta (reply_uid), envia o resultado de volta para o servidor de Relay
    if (replyUid) {
      await this._sendReply(replyUid, {
        command_id: commandId,
        action,
        result,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Responde ao chamador através de um webhook de resposta no Relay
   */
  async _sendReply(replyUid, replyPayload) {
    try {
      const url = `${this.config.serverUrl}/relay/${replyUid}/webhook/response`;
      await this._httpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`
        },
        body: JSON.stringify(replyPayload),
        timeout: 5000
      });
      console.log(`[RelayService] Resposta do comando enviada para /relay/${replyUid}/webhook/response`);
    } catch (err) {
      console.warn(`[RelayService] Aviso: não foi possível postar resposta para ${replyUid}:`, err.message);
    }
  }

  // ========== EXECUTORES DE COMANDOS DO CLI ==========

  async _getDelugeClient() {
    let port = 8112;
    let password = 'deluge';

    try {
      const creds = obterCredenciaisDelugeLocal();
      port = creds.delugeWeb.porta;
    } catch (e) {
      // Ignora erro de detecção automática
    }

    try {
      const dbPort = await SystemSetting.findOne({ where: { key: 'delugePort' } });
      const dbPassword = await SystemSetting.findOne({ where: { key: 'delugePassword' } });
      if (dbPort && dbPort.value) port = parseInt(dbPort.value, 10);
      if (dbPassword && dbPassword.value) password = dbPassword.value;
    } catch (e) {
      // Ignora
    }

    const client = new DelugeClient(port, password);
    await client.login();
    return client;
  }

  async _cmdAddTorrent(params) {
    const magnetLink = params.magnet || params.magnetLink;
    if (!magnetLink) {
      return { success: false, error: 'Parâmetro magnet ou magnetLink é obrigatório.' };
    }
    const client = await this._getDelugeClient();
    const torrentId = await client.addMagnet(magnetLink);
    return { success: true, torrentId, message: 'Torrent adicionado com sucesso à fila de downloads!' };
  }

  async _cmdAddUrl(params) {
    const url = params.url;
    if (!url) {
      return { success: false, error: 'Parâmetro url é obrigatório.' };
    }
    const client = await this._getDelugeClient();
    const torrentId = await client.addTorrentFromUrl(url);
    return { success: true, torrentId, message: 'Torrent adicionado a partir da URL!' };
  }

  async _cmdGetTorrents() {
    try {
      const client = await this._getDelugeClient();
      const torrents = await client.getStatus();
      return { success: true, torrents };
    } catch (err) {
      return { success: false, error: `Falha ao obter status do Deluge: ${err.message}` };
    }
  }

  async _cmdPauseTorrent(params) {
    const id = params.id || params.torrentId;
    if (!id) return { success: false, error: 'ID do torrent não informado.' };
    const client = await this._getDelugeClient();
    await client.pauseTorrent(id);
    return { success: true, message: `Torrent ${id} pausado.` };
  }

  async _cmdResumeTorrent(params) {
    const id = params.id || params.torrentId;
    if (!id) return { success: false, error: 'ID do torrent não informado.' };
    const client = await this._getDelugeClient();
    await client.resumeTorrent(id);
    return { success: true, message: `Torrent ${id} retomado.` };
  }

  async _cmdRemoveTorrent(params) {
    const id = params.id || params.torrentId;
    if (!id) return { success: false, error: 'ID do torrent não informado.' };
    const removeData = Boolean(params.removeData || params.withData);
    const client = await this._getDelugeClient();
    await client.removeTorrent(id, removeData);
    return { success: true, message: `Torrent ${id} removido ${removeData ? 'com arquivos físicos' : 'apenas da fila'}.` };
  }

  async _cmdNewSearch(params) {
    const query = (params.query || params.termo || '').trim();
    if (!query) {
      return { success: false, error: 'O termo de busca (query) é obrigatório.' };
    }
    const search = await Search.create({
      query,
      status: 'pending'
    });
    enqueueSearch(search.id, false);
    return {
      success: true,
      searchId: search.id,
      query: search.query,
      status: search.status,
      message: `Busca com IA iniciada com sucesso (ID: ${search.id})!`
    };
  }

  async _cmdGetSearches(params) {
    const limit = Math.min(parseInt(params.limit || 15, 10), 50);
    const searches = await Search.findAll({
      limit,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'query', 'status', 'chosenTorrentId', 'errorMessage', 'createdAt', 'updatedAt']
    });
    return { success: true, searches };
  }

  async _cmdGetSearchDetail(params) {
    const id = params.id || params.searchId;
    if (!id) return { success: false, error: 'ID da busca não informado.' };
    const search = await Search.findByPk(id, {
      include: [
        { model: TorrentResult, as: 'TorrentResults' },
        { model: TorrentEvaluation, as: 'TorrentEvaluations' },
        { model: AgentLog, as: 'AgentLogs' }
      ]
    });
    if (!search) return { success: false, error: 'Busca não encontrada.' };
    return { success: true, search };
  }

  async _cmdStopSearch(params) {
    const id = params.id || params.searchId;
    if (!id) return { success: false, error: 'ID da busca não informado.' };
    stopSearchAgent(id);
    return { success: true, message: `Busca ${id} interrompida.` };
  }

  async _cmdRestartSearch(params) {
    const id = params.id || params.searchId;
    if (!id) return { success: false, error: 'ID da busca não informado.' };
    const search = await Search.findByPk(id);
    if (!search) return { success: false, error: 'Busca não encontrada.' };
    await search.update({ status: 'pending', errorMessage: null });
    enqueueSearch(id, true);
    return { success: true, message: `Busca ${id} reiniciada.` };
  }

  async _cmdGetSettings() {
    const dbSettings = await SystemSetting.findAll();
    const config = {};
    dbSettings.forEach(s => {
      config[s.key] = s.value;
    });
    // Oculta tokens sensíveis
    const safeConfig = { ...config };
    if (safeConfig.aiToken) safeConfig.aiToken = '******';
    if (safeConfig.relay_access_token) safeConfig.relay_access_token = '******';
    return { success: true, settings: safeConfig };
  }

  async _cmdSaveSettings(params) {
    const entries = params.settings || params;
    for (const key of Object.keys(entries)) {
      if (['aiProvider', 'aiModel', 'aiUrl', 'aiToken', 'preferredAudioLanguage', 'preferredSubtitleLanguage', 'preferredResolution', 'minFreeSpaceGB', 'autoDeleteOldFiles'].includes(key)) {
        await SystemSetting.upsert({ key, value: String(entries[key]) });
      }
    }
    return { success: true, message: 'Configurações de IA salvas com sucesso.' };
  }

  async _cmdTestAi(params) {
    const testConfig = params.config || params;
    const result = await testConnection(testConfig);
    return result;
  }

  // ========== HELPERS DE REDE ==========

  _scheduleReconnect(delayMs) {
    if (!this.shouldRun) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    console.log(`[RelayService] Agendando reconexão em ${delayMs / 1000}s...`);
    this.reconnectTimeout = setTimeout(() => {
      this._connectCycle();
    }, delayMs);
  }

  _httpRequest(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(urlStr);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: options.method || 'GET',
          headers: options.headers || {}
        };

        const req = transport.request(reqOptions, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          });
        });

        req.on('error', reject);

        if (options.timeout) {
          req.setTimeout(options.timeout, () => {
            req.destroy(new Error(`Timeout de requisição (${options.timeout}ms)`));
          });
        }

        if (options.body) {
          req.write(options.body);
        }

        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

const relayService = new RelayService();

module.exports = {
  relayService
};
