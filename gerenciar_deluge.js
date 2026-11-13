const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Gerenciador de Torrents do Deluge (Local)
 * 
 * Este script interage com a API JSON-RPC do Deluge-Web localmente para gerenciar
 * downloads. Ele automaticamente descobre as credenciais necessárias através do 
 * módulo 'obter_deluge_creds.js'.
 */

class DelugeClient {
  constructor(port, password, host) {
    this.port = port || 8112;
    this.password = password || 'deluge';
    this.host = host || 'localhost';
    this.cookie = null;
    this.requestId = 1;
  }

  /**
   * Envia uma requisição HTTP POST para a API JSON-RPC do Deluge-Web
   */
  request(method, params = []) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        method: method,
        params: params,
        id: this.requestId++
      });

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      };

      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }

      const req = http.request({
        hostname: this.host || 'localhost',
        port: this.port,
        path: '/json',
        method: 'POST',
        headers: headers
      }, (res) => {
        // Captura o cookie da sessão se retornado
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          // Extrai o _session_id do header Set-Cookie
          const cookieMatch = setCookie[0].match(/_session_id=[^;]+/);
          if (cookieMatch) {
            this.cookie = cookieMatch[0];
          }
        }

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.error) {
              return reject(new Error(`Erro RPC Deluge: ${response.error.message || JSON.stringify(response.error)}`));
            }
            resolve(response.result);
          } catch (e) {
            reject(new Error(`Resposta inválida da API Deluge Web: ${body.substring(0, 100)}...`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Falha de conexão com Deluge-Web (porta ${this.port}): ${e.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Efetua o login na API Web do Deluge
   */
  async login() {
    const success = await this.request('auth.login', [this.password]);
    if (!success) {
      throw new Error('Falha na autenticação do Deluge-Web. Senha incorreta.');
    }
    
    // Verifica se estamos conectados a algum daemon
    const connected = await this.request('web.connected');
    if (!connected) {
      // Se não conectado, obtém a lista de daemons configurados e se conecta ao primeiro
      const hosts = await this.request('web.get_hosts');
      if (hosts && hosts.length > 0) {
        const hostId = hosts[0][0];
        await this.request('web.connect', [hostId]);
      } else {
        throw new Error('Nenhum daemon do Deluge configurado para conexão.');
      }
    }
  }

  /**
   * Adiciona um torrent por link Magnet
   */
  async addMagnet(magnetUrl) {
    return this.request('core.add_torrent_magnet', [magnetUrl, {}]);
  }

  /**
   * Obtém o status de todos os torrents ou de um específico.
   * Por padrão usa campos enxutos (sem 'files' e 'file_progress') para não sobrecarregar
   * CPU, tráfego JSON e memória em ambientes com recursos limitados.
   */
  async getStatus(fields = null) {
    const defaultFields = [
      'name', 'progress', 'state', 'total_size', 
      'paused', 'ratio', 'download_payload_rate', 'upload_payload_rate', 
      'eta', 'num_peers', 'num_seeds', 'total_done', 'save_path'
    ];
    const torrents = await this.request('core.get_torrents_status', [{}, fields || defaultFields]);
    if (torrents && typeof torrents === 'object') {
      const checkedSaveDirs = new Map();
      for (const id of Object.keys(torrents)) {
        const t = torrents[id];
        if (t && t.total_done > 0 && t.save_path && t.name) {
          let dirExists = checkedSaveDirs.get(t.save_path);
          if (dirExists === undefined) {
            dirExists = fs.existsSync(t.save_path);
            checkedSaveDirs.set(t.save_path, dirExists);
          }
          if (dirExists && !fs.existsSync(path.join(t.save_path, t.name))) {
            t.filesMissing = true;
          }
        }
      }
    }
    return torrents;
  }

  /**
   * Obtém o status detalhado de um único torrent pelo ID
   */
  async getTorrentStatus(torrentId, fields = null) {
    const defaultFields = [
      'name', 'progress', 'state', 'total_size',
      'paused', 'ratio', 'download_payload_rate', 'upload_payload_rate',
      'eta', 'num_peers', 'num_seeds', 'total_done',
      'save_path', 'download_location', 'files', 'file_progress', 'message', 'trackers'
    ];
    try {
      const res = await this.request('core.get_torrent_status', [torrentId, fields || defaultFields]);
      if (res && typeof res === 'object' && Object.keys(res).length > 0) {
        return res;
      }
    } catch (e) {
      // Fallback via get_torrents_status
    }
    const all = await this.request('core.get_torrents_status', [{ id: [torrentId] }, fields || defaultFields]);
    return all ? all[torrentId] || null : null;
  }

  /**
   * Força a reverificação (force_recheck) dos arquivos de um ou mais torrents no disco
   */
  async forceRecheck(torrentIds) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.force_recheck', [ids]);
  }

  /**
   * Define opções para um ou mais torrents (ex: auto_managed, stop_at_ratio)
   */
  async setTorrentOptions(torrentIds, options = {}) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.set_torrent_options', [ids, options]);
  }

  /**
   * Obtém o Magnet URI de um torrent presente na sessão do Deluge
   */
  async getMagnetUri(torrentId) {
    return this.request('core.get_magnet_uri', [torrentId]);
  }

  /**
   * Pausa um ou mais torrents
   */
  async pause(torrentIds) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.pause_torrent', [ids]);
  }

  async pauseTorrent(torrentId) {
    return this.pause(torrentId);
  }

  /**
   * Retoma (resume) um ou mais torrents pausados
   */
  async resume(torrentIds) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.resume_torrent', [ids]);
  }

  async resumeTorrent(torrentId) {
    return this.smartResume(torrentId);
  }

  /**
   * Verifica se os arquivos de um torrent que já possuía progresso foram apagados do disco
   */
  hasMissingFilesOnDisk(torrent, fallbackDownloadPath = null) {
    if (!torrent) return false;
    const hadProgress = (torrent.total_done && torrent.total_done > 0) || (torrent.progress && torrent.progress > 0);
    if (!hadProgress) return false;

    const saveDir = torrent.save_path || torrent.download_location || fallbackDownloadPath;
    if (!saveDir || typeof saveDir !== 'string') return false;

    // Se nem o diretório base existe localmente, verificamos se o diretório pai existe neste host
    if (!fs.existsSync(saveDir)) {
      const parentDir = path.dirname(saveDir);
      if (parentDir && parentDir !== saveDir && fs.existsSync(parentDir)) {
        return true;
      }
      return false;
    }

    // 1. Verifica pela lista de arquivos do torrent
    if (Array.isArray(torrent.files) && torrent.files.length > 0) {
      let anyExisting = false;
      for (let i = 0; i < torrent.files.length; i++) {
        const f = torrent.files[i];
        if (!f || !f.path) continue;
        const fullPath = path.join(saveDir, f.path);
        const exists = fs.existsSync(fullPath);
        if (exists) anyExisting = true;

        const fProg = Array.isArray(torrent.file_progress) && torrent.file_progress[i] !== undefined
          ? torrent.file_progress[i]
          : (torrent.progress || 0) / 100;

        // Se o Deluge acredita que o arquivo já tinha dados baixados mas ele não existe no disco
        if (fProg > 0 && !exists) {
          return true;
        }
      }
      if (!anyExisting) {
        return true;
      }
    } else if (torrent.name) {
      // 2. Fallback pelo nome raiz do torrent
      const rootPath = path.join(saveDir, torrent.name);
      if (!fs.existsSync(rootPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Retoma um torrent resolvendo automaticamente problemas como estado de Erro
   * ou arquivos apagados do disco (forçando recheck e reiniciando o download).
   */
  async smartResume(torrentId, options = {}) {
    const { fallbackDownloadPath = null, fallbackMagnet = null, onBeforeRestart = null } = options;

    const statusFields = [
      'name', 'progress', 'state', 'total_size',
      'paused', 'total_done', 'save_path', 'download_location',
      'files', 'file_progress', 'message', 'trackers'
    ];

    let torrent = await this.getTorrentStatus(torrentId, statusFields).catch(() => null);
    if (!torrent) {
      // Caso não consiga ler status detalhado, tenta o resume direto
      await this.resume(torrentId);
      return { success: true, restarted: false, rechecked: false };
    }

    const isErrorState = torrent.state === 'Error' ||
      Boolean(torrent.message && torrent.state !== 'Downloading' && torrent.state !== 'Seeding');
    const filesMissing = this.hasMissingFilesOnDisk(torrent, fallbackDownloadPath);

    let needsRecovery = isErrorState || filesMissing;

    // Se aparentemente não há erro nem arquivos ausentes, tenta o resume normal primeiro
    if (!needsRecovery) {
      await this.setTorrentOptions(torrentId, { auto_managed: true }).catch(() => {});
      await this.resume(torrentId);

      // Aguarda brevemente para checar se o Deluge/libtorrent acusou erro de arquivo ao tentar retomar
      await new Promise(r => setTimeout(r, 400));
      const afterQuickResume = await this.getTorrentStatus(torrentId, [
        'name', 'state', 'paused', 'progress', 'total_done', 'message'
      ]).catch(() => null);

      if (afterQuickResume && afterQuickResume.state === 'Error') {
        needsRecovery = true;
        torrent = { ...torrent, ...afterQuickResume };
      } else {
        return {
          success: true,
          restarted: false,
          rechecked: false,
          state: afterQuickResume ? afterQuickResume.state : torrent.state
        };
      }
    }

    // === FLUXO DE RECUPERAÇÃO E REINÍCIO DE DOWNLOAD ===
    if (typeof onBeforeRestart === 'function') {
      await onBeforeRestart(torrent).catch(() => {});
    }

    const saveDir = torrent.save_path || torrent.download_location || fallbackDownloadPath;
    if (saveDir && !fs.existsSync(saveDir)) {
      try {
        const parentDir = path.dirname(saveDir);
        if (parentDir && fs.existsSync(parentDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }
      } catch (mkdirErr) {}
    }

    // 1. Ajusta opções para garantir que o Deluge não mantenha o torrent pausado por ratio/fila
    await this.setTorrentOptions(torrentId, { auto_managed: true, stop_at_ratio: false }).catch(() => {});

    // 2. Chama resume antes do forceRecheck (para limpar flag is_paused se não estiver em Error)
    await this.resume(torrentId).catch(() => {});

    // 3. Força recheck no Deluge para limpar estado de Error e zerar progresso dos arquivos apagados
    await this.forceRecheck(torrentId);

    // 4. Chama resume logo em seguida
    await this.resume(torrentId).catch(() => {});

    // 5. Aguarda a conclusão do Checking (quando arquivos foram apagados, o recheck leva poucos ms)
    // Como o Deluge salva `forcing_recheck_paused = True` quando o torrent estava em Error/Paused,
    // ele pausa o torrent automaticamente ao terminar o `force_recheck`. Por isso, monitoramos o
    // término do `Checking` e enviamos `resume` imediatamente após!
    let finalStatus = null;
    let finishedChecking = false;

    for (let attempt = 0; attempt < 14; attempt++) {
      await new Promise(r => setTimeout(r, 350));
      finalStatus = await this.getTorrentStatus(torrentId, [
        'name', 'state', 'paused', 'progress', 'total_size', 'total_done', 'message'
      ]).catch(() => null);

      if (!finalStatus) break;

      if (finalStatus.state === 'Checking' || finalStatus.state === 'Allocating') {
        continue;
      }

      finishedChecking = true;

      if (finalStatus.paused || finalStatus.state === 'Paused' || finalStatus.state === 'Queued') {
        await this.setTorrentOptions(torrentId, { auto_managed: true, stop_at_ratio: false }).catch(() => {});
        await this.resume(torrentId).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
        finalStatus = await this.getTorrentStatus(torrentId, [
          'name', 'state', 'paused', 'progress', 'total_size', 'total_done', 'message'
        ]).catch(() => finalStatus);
      }
      break;
    }

    // 6. Fallback definitivo: se mesmo após force_recheck + resume o torrent continuar em estado 'Error',
    // recria o torrent na sessão a partir do seu Magnet URI para reiniciar o download do zero.
    if (finalStatus && finalStatus.state === 'Error') {
      let magnetUri = await this.getMagnetUri(torrentId).catch(() => null);
      if (!magnetUri || typeof magnetUri !== 'string' || !magnetUri.startsWith('magnet:')) {
        if (fallbackMagnet && fallbackMagnet.startsWith('magnet:')) {
          magnetUri = fallbackMagnet;
        } else if (/^[a-fA-F0-9]{40}$/.test(torrentId)) {
          const dn = torrent.name ? `&dn=${encodeURIComponent(torrent.name)}` : '';
          const trList = Array.isArray(torrent.trackers)
            ? torrent.trackers.map(t => (t && t.url ? `&tr=${encodeURIComponent(t.url)}` : '')).join('')
            : '';
          magnetUri = `magnet:?xt=urn:btih:${torrentId}${dn}${trList}`;
        }
      }

      if (magnetUri) {
        await this.remove(torrentId, false).catch(() => {});
        await new Promise(r => setTimeout(r, 250));
        await this.addMagnet(magnetUri);
        await this.setTorrentOptions(torrentId, { auto_managed: true, stop_at_ratio: false }).catch(() => {});
        await this.resume(torrentId).catch(() => {});
        finalStatus = await this.getTorrentStatus(torrentId, [
          'name', 'state', 'paused', 'progress', 'total_size', 'total_done', 'message'
        ]).catch(() => finalStatus);
      }
    }

    return {
      success: true,
      restarted: true,
      rechecked: true,
      stillChecking: !finishedChecking && finalStatus && finalStatus.state === 'Checking',
      filesMissing,
      wasError: isErrorState,
      state: finalStatus ? finalStatus.state : 'Downloading'
    };
  }

  /**
   * Remove um torrent
   * @param {string} torrentId ID do torrent (info hash)
   * @param {boolean} removeData true para apagar os arquivos baixados, false para manter
   */
  async remove(torrentId, removeData = false) {
    return this.request('core.remove_torrent', [torrentId, removeData]);
  }

  async removeTorrent(torrentId, removeData = false) {
    return this.remove(torrentId, removeData);
  }

  /**
   * Obtém as configurações do daemon (incluindo diretórios)
   */
  async getConfig() {
    return this.request('core.get_config');
  }
}

/**
 * Função para formatar tamanhos em bytes para leitura humana
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Função para formatar ETA em segundos para leitura humana
 */
function formatETA(seconds) {
  if (!seconds || seconds <= 0) return 'Concluído/N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
}

// Interface de linha de comando para testes/uso direto
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd) {
    console.log(`
Uso do CLI Deluge Manager:
  node gerenciar_deluge.js status                   - Mostra todos os downloads e seu status
  node gerenciar_deluge.js add <magnet_link>        - Adiciona um novo download por Magnet Link
  node gerenciar_deluge.js pause <torrent_id|all>  - Pausa um torrent específico ou todos
  node gerenciar_deluge.js resume <torrent_id|all> - Retoma um torrent específico ou todos
  node gerenciar_deluge.js remove <torrent_id>      - Remove o torrent mantendo os arquivos
  node gerenciar_deluge.js delete <torrent_id>      - Remove o torrent E apaga os arquivos baixados
`);
    process.exit(0);
  }

  try {
    // 1. Tenta obter as credenciais automaticamente
    const creds = obterCredenciaisDelugeLocal();
    const port = creds.delugeWeb.porta;
    const password = creds.delugeWeb.senhaPadraoDetectada ? 'deluge' : 'deluge'; // default fallback se hash de 'deluge' for true
    
    // 2. Instancia e conecta o cliente
    const client = new DelugeClient(port, password);
    await client.login();

    // 3. Executa as operações do CLI
    if (cmd === 'status') {
      const torrents = await client.getStatus([
        'name', 'progress', 'state', 'total_size', 'files', 
        'paused', 'ratio', 'download_payload_rate', 'upload_payload_rate', 
        'eta', 'num_peers', 'num_seeds', 'total_done', 'file_progress'
      ]);
      const ids = Object.keys(torrents);

      if (ids.length === 0) {
        console.log('Nenhum torrent em andamento ou na fila.');
        return;
      }

      console.log('\n=== STATUS DOS DOWNLOADS NO DELUGE ===');
      for (const id of ids) {
        const t = torrents[id];
        console.log(`\nNome: ${t.name}`);
        console.log(`ID (Hash): ${id}`);
        console.log(`Status: ${t.state}`);
        console.log(`Progresso: ${t.progress.toFixed(2)}%`);
        console.log(`Tamanho Total: ${formatBytes(t.total_size)} (Concluído: ${formatBytes(t.total_done)})`);
        console.log(`Velocidade DL: ${formatBytes(t.download_payload_rate)}/s | UL: ${formatBytes(t.upload_payload_rate)}/s`);
        console.log(`ETA: ${formatETA(t.eta)} | Ratio: ${t.ratio.toFixed(2)}`);
        console.log(`Peers: ${t.num_peers} | Seeds: ${t.num_seeds}`);
        
        if (t.files && t.files.length > 0) {
          console.log('Arquivos:');
          t.files.forEach((file, index) => {
            const fileProg = (t.file_progress && t.file_progress[index] !== undefined)
              ? (t.file_progress[index] * 100).toFixed(1)
              : '0.0';
            console.log(` - [${fileProg}%] ${file.path} (${formatBytes(file.size)})`);
          });
        }
        console.log('--------------------------------------');
      }
    } 
    else if (cmd === 'add') {
      const magnet = args[1];
      if (!magnet) {
        console.error('Erro: Você precisa informar o Magnet Link.');
        process.exit(1);
      }
      const torrentId = await client.addMagnet(magnet);
      console.log(`Torrent adicionado com sucesso! InfoHash: ${torrentId}`);
    } 
    else if (cmd === 'pause') {
      const target = args[1];
      if (!target) {
        console.error('Erro: Informe o ID do torrent ou "all".');
        process.exit(1);
      }
      
      let idsToPause = [target];
      if (target === 'all') {
        const torrents = await client.getStatus();
        idsToPause = Object.keys(torrents);
      }
      
      await client.pause(idsToPause);
      console.log(`Operação de pausar concluída para: ${idsToPause.join(', ')}`);
    } 
    else if (cmd === 'resume') {
      const target = args[1];
      if (!target) {
        console.error('Erro: Informe o ID do torrent ou "all".');
        process.exit(1);
      }
      
      let idsToResume = [target];
      if (target === 'all') {
        const torrents = await client.getStatus();
        idsToResume = Object.keys(torrents);
      }
      
      for (const id of idsToResume) {
        await client.smartResume(id);
      }
      console.log(`Operação de retomar concluída para: ${idsToResume.join(', ')}`);
    } 
    else if (cmd === 'remove' || cmd === 'delete') {
      const target = args[1];
      if (!target) {
        console.error('Erro: Informe o ID do torrent.');
        process.exit(1);
      }
      
      const removeData = (cmd === 'delete');
      const success = await client.remove(target, removeData);
      console.log(`Remoção do torrent ${target} (apagar dados=${removeData}): ${success ? 'Sucesso' : 'Falhou'}`);
    } 
    else {
      console.error(`Comando desconhecido: ${cmd}`);
    }

  } catch (error) {
    console.error('Erro ao executar operação no Deluge:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DelugeClient };
