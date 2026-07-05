const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Inicializa o banco de dados SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false // Desativa logs do Sequelize no console
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

// Função para inicializar e semear o banco de dados
async function initDatabase() {
  await sequelize.sync();
  
  // Seed de Configurações do Sistema Padrão se não existirem
  const defaultSettings = [
    { key: 'aiProvider', value: 'openai' },
    { key: 'aiUrl', value: 'http://localhost:8045/v1' },
    { key: 'aiToken', value: 'SUA_API_KEY_AQUI' },
    { key: 'aiModel', value: 'gemini-3-flash' },
    { key: 'preferredLanguage', value: 'Português' },
    { key: 'preferredResolution', value: '1080p' }
  ];
  
  for (const setting of defaultSettings) {
    await SystemSetting.findOrCreate({
      where: { key: setting.key },
      defaults: { value: setting.value }
    });
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
}

module.exports = {
  sequelize,
  SystemSetting,
  SearchSource,
  Search,
  TorrentResult,
  TorrentEvaluation,
  AgentLog,
  initDatabase
};
