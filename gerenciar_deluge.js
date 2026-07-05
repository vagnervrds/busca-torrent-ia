const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');
const http = require('http');

/**
 * Gerenciador de Torrents do Deluge (Local)
 * 
 * Este script interage com a API JSON-RPC do Deluge-Web localmente para gerenciar
 * downloads. Ele automaticamente descobre as credenciais necessárias através do 
 * módulo 'obter_deluge_creds.js'.
 */

class DelugeClient {
  constructor(port, password) {
    this.port = port || 8112;
    this.password = password || 'deluge';
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
        hostname: 'localhost',
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
   * Obtém o status de todos os torrents ou de um específico
   */
  async getStatus() {
    const fields = [
      'name', 'progress', 'state', 'total_size', 'files', 
      'paused', 'ratio', 'download_payload_rate', 'upload_payload_rate', 
      'eta', 'num_peers', 'num_seeds', 'total_done', 'file_progress'
    ];
    return this.request('core.get_torrents_status', [{}, fields]);
  }

  /**
   * Pausa um ou mais torrents
   */
  async pause(torrentIds) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.pause_torrent', [ids]);
  }

  /**
   * Retoma (resume) um ou mais torrents pausados
   */
  async resume(torrentIds) {
    const ids = Array.isArray(torrentIds) ? torrentIds : [torrentIds];
    return this.request('core.resume_torrent', [ids]);
  }

  /**
   * Remove um torrent
   * @param {string} torrentId ID do torrent (info hash)
   * @param {boolean} removeData true para apagar os arquivos baixados, false para manter
   */
  async remove(torrentId, removeData = false) {
    return this.request('core.remove_torrent', [torrentId, removeData]);
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
      const torrents = await client.getStatus();
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
      
      await client.resume(idsToResume);
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
