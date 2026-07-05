const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script de integração local para descobrir e obter credenciais do Deluge.
 * 
 * Este script roda diretamente no servidor onde o Deluge está instalado.
 * Ele tenta ler os arquivos de configuração localmente:
 * - /var/lib/deluged/config/auth
 * - /var/lib/deluged/config/web.conf
 * 
 * Se o usuário atual não tiver permissão de leitura direta (comum pois pertencem ao usuário debian-deluged),
 * o script tentará ler os arquivos executando "sudo cat" internamente.
 * 
 * =============================================================================
 * EXEMPLO DE INTEGRAÇÃO EM OUTRA APLICAÇÃO NODE.JS:
 * =============================================================================
 * 
 * const { obterCredenciaisDelugeLocal } = require('./obter_deluge_creds');
 * 
 * try {
 *   const credenciais = obterCredenciaisDelugeLocal();
 *   console.log('Dados do Deluge Daemon (RPC):', credenciais.delugeDaemon);
 *   console.log('Dados do Deluge Web (Porta/Senha):', credenciais.delugeWeb);
 *   
 *   // Exemplo: Conectar via Deluge Web JSON-RPC usando a porta e senha padrão (se detectada)
 *   // const delugePort = credenciais.delugeWeb.porta;
 *   // const delugePassword = credenciais.delugeWeb.senhaPadraoDetectada ? 'deluge' : 'SUA_SENHA';
 * } catch (err) {
 *   console.error('Erro ao integrar credenciais do deluge:', err.message);
 * }
 * =============================================================================
 */

const CONFIG_DIR = '/var/lib/deluged/config';
const AUTH_FILE = path.join(CONFIG_DIR, 'auth');
const WEB_CONF_FILE = path.join(CONFIG_DIR, 'web.conf');

/**
 * Tenta ler o conteúdo de um arquivo de forma síncrona.
 * Se der erro de permissão (EACCES), tenta obter o conteúdo usando sudo cat.
 */
function lerArquivoLocal(caminhoArquivo) {
  try {
    // Tenta leitura direta
    return fs.readFileSync(caminhoArquivo, 'utf8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'ENOENT') {
      try {
        // Tenta leitura usando sudo se a direta falhar por permissão
        return execSync(`sudo cat ${caminhoArquivo}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch (sudoErr) {
        throw new Error(`Permissão negada ao tentar ler ${caminhoArquivo}. Certifique-se de executar o script com "sudo node ..." ou que o usuário atual tenha acesso.`);
      }
    }
    throw err;
  }
}

/**
 * Função principal para obter as credenciais do Deluge localmente
 */
function obterCredenciaisDelugeLocal() {
  try {
    // 1. Lê os arquivos locais do deluge
    const authConteudo = lerArquivoLocal(AUTH_FILE);
    const webConteudo = lerArquivoLocal(WEB_CONF_FILE);

    // 2. Processa o arquivo de autenticação do daemon (auth)
    const daemonCredentials = [];
    const authLines = authConteudo.trim().split('\n');
    for (let line of authLines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      
      const parts = line.split(':');
      if (parts.length >= 2) {
        daemonCredentials.push({
          username: parts[0],
          password: parts[1], // Esta é a senha ou hash usada para o daemon RPC (porta 58846)
          level: parts[2] ? Number(parts[2]) : 10
        });
      }
    }

    // 3. Processa o arquivo web.conf do Deluge-Web
    let webPasswordHash = null;
    let webPort = 8112; // Porta padrão

    try {
      // O arquivo web.conf pode conter múltiplos blocos JSON concatenados ou lixo inicial
      const jsonStart = webConteudo.indexOf('{', webConteudo.indexOf('{') + 1); // Ignora o cabeçalho de metadados
      const jsonContent = jsonStart !== -1 ? webConteudo.slice(jsonStart) : webConteudo;
      
      const webConfig = JSON.parse(jsonContent);
      webPasswordHash = webConfig.pwd_sha1 || null;
      webPort = webConfig.port || 8112;
    } catch (parseErr) {
      // Tenta um parse alternativo simples se o JSON completo falhar
      const portMatch = webConteudo.match(/"port":\s*(\d+)/);
      const shaMatch = webConteudo.match(/"pwd_sha1":\s*"([^"]+)"/);
      if (portMatch) webPort = Number(portMatch[1]);
      if (shaMatch) webPasswordHash = shaMatch[1];
    }

    // 4. Monta o objeto final para retorno
    return {
      sistema: {
        tipoConexao: 'local',
        usuarioExecucao: process.env.USER || process.env.USERNAME || 'desconhecido'
      },
      delugeDaemon: {
        porta: 58846, // Porta de escuta do daemon deluged
        credenciais: daemonCredentials
      },
      delugeWeb: {
        porta: webPort,
        senhaSha1: webPasswordHash,
        senhaPadraoDetectada: (webPasswordHash === '2ce1a410bcdcc53064129b6d950f2e9fee4edc1e') // hash de 'deluge'
      }
    };

  } catch (error) {
    console.error('Erro ao ler credenciais do Deluge:', error.message);
    throw error;
  }
}

// Execução direta via terminal
if (require.main === module) {
  try {
    const dados = obterCredenciaisDelugeLocal();
    console.log('\n================ CREDENCIAIS DELUGE LOCALIZADAS ================');
    console.log(JSON.stringify(dados, null, 2));
    console.log('=================================================================\n');
  } catch (err) {
    process.exit(1);
  }
}

module.exports = { obterCredenciaisDelugeLocal };
