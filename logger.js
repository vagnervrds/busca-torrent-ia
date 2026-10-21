const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(__dirname, 'log');
const CURRENT_LOG_FILE = path.join(LOG_DIR, 'log.log');
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

// Garante que a pasta log/ existe
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    process.stderr.write(`[Logger] Erro ao criar diretório de log: ${err.message}\n`);
  }
}

/**
 * Formata data/hora atual com milissegundos para rotação: YYYY-MM-DD_HH-mm-ss-SSS
 */
function getRotationTimestamp(date = new Date()) {
  const pad = (num, len = 2) => String(num).padStart(len, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${ms}`;
}

/**
 * Formata data/hora para o cabeçalho do log em linha: YYYY-MM-DD HH:mm:ss.SSS
 */
function getLogTimestamp(date = new Date()) {
  const pad = (num, len = 2) => String(num).padStart(len, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Verifica se log.log atingiu 1MB e rotaciona renomeando para log-YYYY-MM-DD_HH-mm-ss-SSS.log
 */
function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(CURRENT_LOG_FILE)) {
      const stats = fs.statSync(CURRENT_LOG_FILE);
      if (stats.size >= MAX_FILE_SIZE_BYTES) {
        const rotatedName = `log-${getRotationTimestamp()}.log`;
        const rotatedPath = path.join(LOG_DIR, rotatedName);
        fs.renameSync(CURRENT_LOG_FILE, rotatedPath);
      }
    }
  } catch (err) {
    process.stderr.write(`[Logger] Erro ao rotacionar arquivo de log: ${err.message}\n`);
  }
}

/**
 * Remove arquivos de log antigos (na pasta log/) com mais de 3 dias
 */
function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(LOG_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        // Se for maior que 3 dias, remove (não importa se é log.log antigo rotacionado)
        // Nota: Se for o log.log atual e estiver inativo por 3 dias, também limpa se necessário
        if (age > MAX_AGE_MS && file !== 'log.log') {
          fs.unlinkSync(filePath);
          writeDirectLog(`[Logger] Arquivo de log antigo removido: ${file}`);
        }
      } catch (err) {
        // Ignora erros individuais de leitura/exclusão
      }
    }
  } catch (err) {
    process.stderr.write(`[Logger] Erro ao limpar logs antigos: ${err.message}\n`);
  }
}

/**
 * Limpeza auxiliar para impedir que logs do PM2 cresçam infinitamente
 */
function cleanPM2Logs() {
  try {
    const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
    const pm2LogDir = path.join(pm2Home, 'logs');

    if (!fs.existsSync(pm2LogDir)) return;

    const files = fs.readdirSync(pm2LogDir);
    const now = Date.now();

    for (const file of files) {
      if (file.includes('busca-torrent-ia') || file.includes('server') || file.includes('agent')) {
        const filePath = path.join(pm2LogDir, file);
        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtimeMs;

          // Trunca arquivo do PM2 se tiver mais de 10 MB ou for mais antigo que 3 dias
          if (stats.size > 10 * 1024 * 1024 || age > MAX_AGE_MS) {
            fs.writeFileSync(filePath, ''); // Esvazia o arquivo sem quebrar a handle do PM2
            writeDirectLog(`[Logger] Log do PM2 truncado/limpo para economizar espaço: ${file}`);
          }
        } catch (err) {}
      }
    }
  } catch (err) {
    // Ignora se não houver acesso ou pasta do PM2
  }
}

/**
 * Gravador direto no log.log
 */
function writeDirectLog(message, level = 'INFO') {
  try {
    rotateLogIfNeeded();
    const timestamp = getLogTimestamp();
    const formattedLine = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(CURRENT_LOG_FILE, formattedLine, 'utf8');
  } catch (err) {
    process.stderr.write(`[Logger] Erro ao gravar em log.log: ${err.message}\n`);
  }
}

// Guarda referências originais do console
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

function formatArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

// Intercepta chamadas do console para gravar automaticamente no log/log.log
console.log = function (...args) {
  originalLog.apply(console, args);
  writeDirectLog(formatArgs(args), 'INFO');
};

console.info = function (...args) {
  originalInfo.apply(console, args);
  writeDirectLog(formatArgs(args), 'INFO');
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  writeDirectLog(formatArgs(args), 'WARN');
};

console.error = function (...args) {
  originalError.apply(console, args);
  writeDirectLog(formatArgs(args), 'ERROR');
};

// Executa limpeza inicial ao carregar o módulo
cleanOldLogs();
cleanPM2Logs();

// Agenda verificação e limpeza periódica a cada 1 hora
const logCleanerInterval = setInterval(() => {
  cleanOldLogs();
  cleanPM2Logs();
}, 60 * 60 * 1000);
if (logCleanerInterval && typeof logCleanerInterval.unref === 'function') {
  logCleanerInterval.unref();
}

// Captura exceções não tratadas para evitar crashes silenciosos e registrar stack trace
process.on('uncaughtException', (err) => {
  const stack = err && err.stack ? err.stack : String(err);
  writeDirectLog(`[FATAL] Exceção não tratada capturada (uncaughtException): ${stack}`, 'FATAL');
  originalError('[FATAL] Exceção não tratada capturada (uncaughtException):', stack);
});

process.on('unhandledRejection', (reason) => {
  const stack = reason && reason.stack ? reason.stack : String(reason);
  writeDirectLog(`[ERROR] Rejeição de Promise não tratada (unhandledRejection): ${stack}`, 'ERROR');
  originalError('[ERROR] Rejeição de Promise não tratada (unhandledRejection):', stack);
});

module.exports = {
  LOG_DIR,
  CURRENT_LOG_FILE,
  writeDirectLog,
  cleanOldLogs,
  cleanPM2Logs
};
