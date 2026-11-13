const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

// Inicializa o banco de dados SQLite com otimizações para hardware modesto / HD antigo
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false, // Desativa logs do Sequelize no console
  pool: {
    max: 1, // Para SQLite (arquivo único), max: 1 previne contenção de travas e conflitos WAL no Windows
    min: 1, // Mantém a conexão aberta para evitar ciclo contínuo de abertura/fechamento de locks no Windows
    acquire: 30000,
    idle: Infinity
  }
});

// Modelo de Configurações do Sistema (SystemSetting)
const SystemSetting = sequelize.define('SystemSetting', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

// Modelo de Fontes de Busca (SearchSource)
const SearchSource = sequelize.define('SearchSource', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  searchUrlPattern: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contentTypes: {
    type: DataTypes.TEXT, // Armazena como array em string JSON (ex: '["series", "movies"]')
    allowNull: false,
    defaultValue: '[]'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

// Modelo de Busca (Search)
const Search = sequelize.define('Search', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  query: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // 'pending', 'searching', 'stopped', 'completed', 'failed'
    validate: {
      isIn: [['pending', 'searching', 'stopped', 'completed', 'failed']]
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unknown' // 'series', 'movie', 'unknown'
  },
  episodesCount: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unknown'
  },
  cost: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0
  },
  initialSource: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  }
});

// Modelo de Resultados de Torrents Correspondentes (TorrentResult)
const TorrentResult = sequelize.define('TorrentResult', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  searchId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  magnetLink: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  pageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true
  },
  seeders: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  leechers: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  episodes: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resolution: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'unknown'
  },
  hasPortugueseAudio: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  hasPortugueseSubtitles: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sourceName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Desconhecido'
  }
});

// Modelo de Avaliação de Torrents (TorrentEvaluation)
const TorrentEvaluation = sequelize.define('TorrentEvaluation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  searchId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  nyaaId: { // Equivalente ao identificador único do torrent no site de origem
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false, // 'matched', 'ignored'
    validate: {
      isIn: [['matched', 'ignored']]
    }
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Modelo de Cache SWR (CacheEntry)
// Armazena snapshots de respostas custosas para a estratégia Stale-While-Revalidate
const CacheEntry = sequelize.define('CacheEntry', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  data: {
    type: DataTypes.TEXT, // JSON serializado do payload
    allowNull: false
  },
  cachedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  ttl: {
    type: DataTypes.INTEGER, // Tempo de vida em segundos
    allowNull: false,
    defaultValue: 30
  }
}, {
  timestamps: false // Gerenciamos cachedAt manualmente
});

// Modelo de Páginas Monitoradas (MonitoredPage)
const MonitoredPage = sequelize.define('MonitoredPage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Página sem título'
  },
  monitor: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  torrentsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastContentChangedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lastCheckedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastCheckResult: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Modelo de Logs do Agente (AgentLog)
const AgentLog = sequelize.define('AgentLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  searchId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  level: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'info' // 'info', 'warn', 'error', 'success'
  }
});

// Relações entre os Modelos
Search.hasMany(TorrentResult, { as: 'results', foreignKey: 'searchId', onDelete: 'CASCADE' });
TorrentResult.belongsTo(Search, { foreignKey: 'searchId' });

Search.hasMany(TorrentEvaluation, { as: 'evaluations', foreignKey: 'searchId', onDelete: 'CASCADE' });
TorrentEvaluation.belongsTo(Search, { foreignKey: 'searchId' });

Search.hasMany(AgentLog, { as: 'logs', foreignKey: 'searchId', onDelete: 'CASCADE' });
AgentLog.belongsTo(Search, { foreignKey: 'searchId' });

// Função auxiliar para auto-recuperação do SQLite antes da inicialização do Sequelize
async function autoRecoverDatabaseIfNeeded() {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const fs = require('fs');
  if (!fs.existsSync(dbPath)) return;

  const sqlite3 = require('sqlite3');

  // Verifica status de integridade sem depender do pool do Sequelize
  const checkStatus = () => new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) return resolve({ ok: false, error: err.message });
      db.all('PRAGMA integrity_check;', (iErr, rows) => {
        if (iErr) {
          db.close();
          return resolve({ ok: false, error: iErr.message });
        }
        const status = rows && rows[0] ? (rows[0].integrity_check || Object.values(rows[0])[0]) : 'ok';
        // Testa também a leitura direta da tabela MonitoredPages para garantir que o B-Tree e índices estão legíveis
        db.all('SELECT id FROM MonitoredPages LIMIT 1;', (mErr) => {
          db.close();
          if (mErr && mErr.message && mErr.message.includes('malformed')) {
            return resolve({ ok: false, error: mErr.message });
          }
          resolve({ ok: status === 'ok', status, error: status !== 'ok' ? status : null });
        });
      });
    });
  });

  const check = await checkStatus();
  if (check.ok) {
    return; // Banco está 100% íntegro
  }

  console.warn(`[SQLite-AutoRecovery] Detectada anomalia no banco de dados (${check.error || check.status}). Iniciando auto-recuperação sem perda de dados...`);

  // 1. Sempre cria um backup de segurança imutável do arquivo original antes de qualquer intervenção
  try {
    const timestamp = Date.now();
    const backupPath = path.join(__dirname, `database.sqlite.auto_backup_${timestamp}.bak`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[SQLite-AutoRecovery] Backup preventivo de segurança criado em: ${backupPath}`);
  } catch (bakErr) {
    console.error('[SQLite-AutoRecovery] Falha ao criar backup preventivo:', bakErr.message);
  }

  // 2. Nível 1: Tenta REINDEX in-place (reconstrói árvores B de índices a partir dos dados existentes sem perder nenhuma linha)
  console.log('[SQLite-AutoRecovery] Nível 1: Executando REINDEX em todos os índices...');
  let reindexSuccess = false;
  try {
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return reject(err);
        db.serialize(() => {
          db.run('REINDEX;', (rErr) => {
            if (rErr) {
              db.close();
              return reject(rErr);
            }
            db.all('PRAGMA integrity_check;', (cErr, rows) => {
              if (cErr) {
                db.close();
                return reject(cErr);
              }
              const st = rows && rows[0] ? (rows[0].integrity_check || Object.values(rows[0])[0]) : 'ok';
              db.all('SELECT id FROM MonitoredPages LIMIT 1;', (mErr) => {
                db.close();
                if (mErr && mErr.message && mErr.message.includes('malformed')) {
                  return reject(mErr);
                }
                if (st === 'ok') resolve();
                else reject(new Error(`Integridade reportou ${st} após REINDEX`));
              });
            });
          });
        });
      });
    });
    console.log('[SQLite-AutoRecovery] Nível 1 bem-sucedido! O banco foi reparado via REINDEX sem perda de dados.');
    reindexSuccess = true;
  } catch (reindexErr) {
    console.warn(`[SQLite-AutoRecovery] Nível 1 não foi suficiente (${reindexErr.message}). Iniciando Nível 2 (Salvamento de dados tabela por tabela)...`);
  }

  if (reindexSuccess) return;

  // 3. Nível 2: Salvamento de dados tabela por tabela para um banco limpo (zero perda dos dados legíveis)
  try {
    const salvagedPath = path.join(__dirname, 'database.sqlite.salvaged');
    if (fs.existsSync(salvagedPath)) fs.unlinkSync(salvagedPath);

    const srcDb = new sqlite3.Database(dbPath);
    const dstDb = new sqlite3.Database(salvagedPath);

    // Obtém DDL de todas as tabelas
    const tables = await new Promise((res, rej) => {
      srcDb.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
        if (err) rej(err);
        else res(rows || []);
      });
    });

    for (const t of tables) {
      if (!t.sql) continue;
      await new Promise((res, rej) => dstDb.run(t.sql, err => err ? rej(err) : res()));
    }

    // Copia todas as linhas acessíveis de cada tabela
    for (const t of tables) {
      let rows = [];
      try {
        rows = await new Promise((res, rej) => {
          srcDb.all(`SELECT * FROM ${t.name}`, (err, data) => err ? rej(err) : res(data || []));
        });
      } catch (readErr) {
        console.warn(`[SQLite-AutoRecovery] Tabela ${t.name} possui blocos danificados. Resgatando linhas intactas via paginação...`);
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          try {
            const chunk = await new Promise((res, rej) => {
              srcDb.all(`SELECT * FROM ${t.name} LIMIT 25 OFFSET ${offset}`, (err, data) => err ? rej(err) : res(data || []));
            });
            if (chunk.length === 0) hasMore = false;
            else {
              rows.push(...chunk);
              offset += 25;
            }
          } catch (chunkErr) {
            offset += 1;
            if (offset > 50000) hasMore = false;
          }
        }
      }

      console.log(`[SQLite-AutoRecovery] Tabela "${t.name}": ${rows.length} registro(s) preservado(s) com sucesso.`);
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        const placeholders = keys.map(() => '?').join(', ');
        const insertSql = `INSERT OR IGNORE INTO ${t.name} (${keys.join(', ')}) VALUES (${placeholders})`;
        await new Promise(r => dstDb.run('BEGIN TRANSACTION', r));
        const stmt = dstDb.prepare(insertSql);
        for (const row of rows) {
          await new Promise(r => stmt.run(Object.values(row), () => r()));
        }
        await new Promise(r => stmt.finalize(r));
        await new Promise(r => dstDb.run('COMMIT', r));
      }
    }

    // Preserva sequences
    try {
      const seqs = await new Promise((res, rej) => {
        srcDb.all("SELECT name, seq FROM sqlite_sequence", (err, data) => err ? rej(err) : res(data || []));
      });
      for (const s of seqs) {
        await new Promise(r => dstDb.run("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)", [s.name, s.seq], r));
      }
    } catch (e) {}

    await new Promise(r => srcDb.close(r));
    await new Promise(r => dstDb.close(r));

    // Substitui o arquivo do banco pelo banco reconstruído
    fs.copyFileSync(salvagedPath, dbPath);
    fs.unlinkSync(salvagedPath);
    console.log('[SQLite-AutoRecovery] Nível 2 concluído com sucesso: banco reconstruído e todos os dados válidos foram salvos.');
  } catch (salvageErr) {
    console.error('[SQLite-AutoRecovery] Erro crítico no procedimento de salvamento:', salvageErr.message);
  }
}

// Função para inicializar e semear o banco de dados
async function initDatabase() {
  // Executa auto-recuperação prévia resiliente caso o banco remoto/local esteja malformado
  await autoRecoverDatabaseIfNeeded();
  // Otimizações cruciais para hardware modesto com HD mecânico antigo (I/O lento e 1GB RAM)
  try {
    await sequelize.query('PRAGMA busy_timeout = 10000;');
    await sequelize.query('PRAGMA journal_mode = WAL;');
    await sequelize.query('PRAGMA synchronous = NORMAL;');
    await sequelize.query('PRAGMA temp_store = MEMORY;');
    await sequelize.query('PRAGMA cache_size = -4000;'); // ~4MB cache em RAM
    // No Windows, mmap_size DEVE ser 0 para evitar erros de SQLITE_CORRUPT decorrentes
    // de restrições do Win32 ao truncar/checkpointar arquivos com ponteiros mapeados em memória
    if (process.platform === 'win32') {
      await sequelize.query('PRAGMA mmap_size = 0;');
    } else {
      await sequelize.query('PRAGMA mmap_size = 33554432;'); // 32MB mmap no Linux
    }
    await sequelize.query('PRAGMA wal_autocheckpoint = 1000;');
    // Checkpoint passivo na inicialização para consolidar dados pendentes do WAL com segurança
    await sequelize.query('PRAGMA wal_checkpoint(PASSIVE);');
  } catch (pragmaErr) {
    console.warn('[SQLite] Aviso ao configurar PRAGMAs de performance:', pragmaErr.message);
  }

  // Verificação de integridade preventiva com auto-recuperação
  try {
    const [chkRows] = await sequelize.query('PRAGMA integrity_check;');
    const status = chkRows && chkRows[0] ? (chkRows[0].integrity_check || Object.values(chkRows[0])[0]) : 'ok';
    if (status !== 'ok') {
      console.warn(`[SQLite] Atenção: integridade reportou "${status}". Executando reparo automático (REINDEX)...`);
      try {
        await sequelize.query('REINDEX;');
      } catch (reindexErr) {
        console.error('[SQLite] Erro ao executar REINDEX:', reindexErr.message);
      }
      try {
        await sequelize.query('VACUUM;');
      } catch (vacuumErr) {
        console.error('[SQLite] Erro ao executar VACUUM:', vacuumErr.message);
      }
      console.log('[SQLite] Procedimento de reparo automático concluído.');
    }
  } catch (integErr) {
    console.warn('[SQLite] Aviso na verificação de integridade:', integErr.message);
  }

  await sequelize.sync();
  
  // Índices para acelerar drasticamente queries no HD físico (elimina FULL TABLE SCANS)
  try {
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_torrent_results_search_id ON TorrentResults(searchId);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_agent_logs_search_id ON AgentLogs(searchId);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_searches_updated_at ON Searches(updatedAt);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_searches_status ON Searches(status);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cache_entries_cached_at ON CacheEntries(cachedAt);');
  } catch (idxErr) {
    console.warn('[SQLite] Aviso ao criar índices:', idxErr.message);
  }

  // Garante a presença da coluna cost na tabela Searches para compatibilidade com bancos já existentes
  try {
    await sequelize.getQueryInterface().addColumn('Searches', 'cost', {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0
    });
  } catch (e) {
    // A coluna já existe ou a tabela foi criada agora por sync()
  }

  // Garante a presença da coluna initialSource na tabela Searches
  try {
    await sequelize.getQueryInterface().addColumn('Searches', 'initialSource', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });
  } catch (e) {
    // A coluna já existe
  }
  
  // Cria tabela de cache SWR se não existir (compatibilidade com bancos existentes)
  try {
    await sequelize.getQueryInterface().createTable('CacheEntries', {
      key: { type: DataTypes.STRING, primaryKey: true },
      data: { type: DataTypes.TEXT, allowNull: false },
      cachedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ttl: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 }
    });
  } catch (e) {
    // Tabela já existe
  }

  // Cria tabela MonitoredPages se não existir
  try {
    await MonitoredPage.sync();
    await sequelize.getQueryInterface().addColumn('MonitoredPages', 'torrentsCount', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  } catch (e) {
    // Tabela/coluna já existe
  }

  try {
    await sequelize.getQueryInterface().addColumn('MonitoredPages', 'lastContentChangedAt', {
      type: DataTypes.DATE,
      allowNull: true
    });
  } catch (e) {
    // Coluna já existe
  }

  try {
    await sequelize.getQueryInterface().addColumn('MonitoredPages', 'imageUrl', {
      type: DataTypes.TEXT,
      allowNull: true
    });
  } catch (e) {
    // Coluna já existe
  }

  try {
    await sequelize.getQueryInterface().addColumn('MonitoredPages', 'lastCheckResult', {
      type: DataTypes.STRING,
      allowNull: true
    });
  } catch (e) {
    // Coluna já existe
  }
  
  // Seed de Configurações do Sistema Padrão se não existirem
  const defaultSettings = [
    { key: 'aiProvider', value: 'openai' },
    { key: 'aiUrl', value: 'https://openrouter.ai/api/v1' },
    { key: 'aiToken', value: '' },
    { key: 'aiModel', value: 'gemini-3-flash' },
    { key: 'preferredAudioLanguage', value: 'Português (Dublado)' },
    { key: 'preferredSubtitleLanguage', value: 'Português (PT-BR)' },
    { key: 'preferredResolution', value: '1080p' },
    { key: 'autoDeleteOldFiles', value: 'true' },
    { key: 'minFreeSpaceGB', value: '4' }
  ];
  
  for (const setting of defaultSettings) {
    await SystemSetting.findOrCreate({
      where: { key: setting.key },
      defaults: { value: setting.value }
    });
  }

  // Atualiza aiUrl legada local se ainda estiver com o padrão antigo
  try {
    const aiUrlSetting = await SystemSetting.findOne({ where: { key: 'aiUrl' } });
    if (aiUrlSetting && (aiUrlSetting.value === 'http://localhost:8045/v1' || !aiUrlSetting.value)) {
      aiUrlSetting.value = 'https://openrouter.ai/api/v1';
      await aiUrlSetting.save();
    }
  } catch (urlUpdateErr) {
    // Ignora erro se não conseguir atualizar
  }
  
  // Seed de Fonte Padrão (Nyaa.si) se nenhuma fonte estiver cadastrada
  const sourcesCount = await SearchSource.count();
  if (sourcesCount === 0) {
    await SearchSource.create({
      name: 'Nyaa.si',
      url: 'https://nyaa.si/',
      searchUrlPattern: 'https://nyaa.si/?f=0&c=0_0&q={query}',
      description: 'Rastreador público de torrents de animes, mangás e mídias asiáticas. Ideal para qualquer busca relacionada a anime, animação japonesa e mangás.',
      contentTypes: JSON.stringify(['series', 'movies', 'music']),
      isActive: true
    });
  }

  // Garante a existência da fonte StarckFilmesBR
  try {
    const starckSource = await SearchSource.findOne({
      where: {
        [Op.or]: [
          { url: { [Op.like]: '%starckfilmes%' } },
          { name: { [Op.like]: '%starck%' } }
        ]
      }
    });
    if (!starckSource) {
      await SearchSource.create({
        name: 'StarckFilmesBR',
        url: 'https://starckfilmesbr.com/',
        searchUrlPattern: 'https://starckfilmesbr.com/?s={query}',
        description: 'Filmes e séries em torrent dublados e legendados em alta definição.',
        contentTypes: JSON.stringify(['movies', 'series']),
        isActive: true
      });
    } else if (starckSource.url !== 'https://starckfilmesbr.com/') {
      starckSource.url = 'https://starckfilmesbr.com/';
      starckSource.searchUrlPattern = 'https://starckfilmesbr.com/?s={query}';
      starckSource.name = 'StarckFilmesBR';
      await starckSource.save();
    }
  } catch (sfErr) {
    console.error('Erro ao verificar fonte StarckFilmesBR:', sfErr.message);
  }

  // Garante a existência da fonte AnimesTorrents
  try {
    const animeSource = await SearchSource.findOne({
      where: {
        [Op.or]: [
          { url: { [Op.like]: '%animestorrents%' } },
          { name: { [Op.like]: '%animestorrents%' } }
        ]
      }
    });
    if (!animeSource) {
      await SearchSource.create({
        name: 'AnimesTorrents',
        url: 'https://www.animestorrents.com/',
        searchUrlPattern: 'https://www.animestorrents.com/?s={query}',
        description: 'Torrents de animes em alta definição, episódios semanais e temporadas completas.',
        contentTypes: JSON.stringify(['series', 'movies', 'music']),
        isActive: true
      });
    } else if (animeSource.url !== 'https://www.animestorrents.com/') {
      animeSource.url = 'https://www.animestorrents.com/';
      animeSource.searchUrlPattern = 'https://www.animestorrents.com/?s={query}';
      animeSource.name = 'AnimesTorrents';
      await animeSource.save();
    }
  } catch (atErr) {
    console.error('Erro ao verificar fonte AnimesTorrents:', atErr.message);
  }

  // Limpeza inicial de entradas de cache expiradas para economizar espaço em disco
  try {
    await cleanupExpiredCache();
  } catch (cleanErr) {
    // Ignora erro
  }
}

/**
 * Limpa entradas expiradas ou em excesso da tabela CacheEntries para economizar espaço no disco físico.
 */
async function cleanupExpiredCache(maxEntries = 50) {
  try {
    // 1. Remove entradas com cachedAt mais antigas que 1 dia
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await CacheEntry.destroy({
      where: {
        cachedAt: { [Op.lt]: oneDayAgo }
      }
    });

    // 2. Garante que o total de entradas não ultrapasse maxEntries
    const totalCount = await CacheEntry.count();
    if (totalCount > maxEntries) {
      const excess = totalCount - maxEntries;
      const oldestEntries = await CacheEntry.findAll({
        attributes: ['key'],
        order: [['cachedAt', 'ASC']],
        limit: excess
      });
      if (oldestEntries.length > 0) {
        const keysToRemove = oldestEntries.map(e => e.key);
        await CacheEntry.destroy({
          where: { key: { [Op.in]: keysToRemove } }
        });
      }
    }
  } catch (err) {
    console.warn('[Cache] Erro durante limpeza periódica de cache:', err.message);
  }
}

module.exports = {
  sequelize,
  SystemSetting,
  SearchSource,
  Search,
  TorrentResult,
  TorrentEvaluation,
  AgentLog,
  CacheEntry,
  MonitoredPage,
  initDatabase,
  cleanupExpiredCache
};
