# Busca Torrent IA 🤖 🎬

O **Busca Torrent IA** é um agente inteligente e automatizado que utiliza Inteligência Artificial, Puppeteer e SQLite para buscar, analisar e gerenciar downloads de torrents de forma autônoma.

Ele foi projetado para rodar em servidores (como DietPi, Raspberry Pi, VPS ou localmente) e automatizar o processo de encontrar o melhor torrent para o seu gosto (idioma, resolução) e enviá-lo diretamente para o seu cliente de torrent.

## 🚀 Funcionalidades Principais

- **Busca Automatizada com Puppeteer:** Navega em sites de torrent simulando comportamento humano e burlando proteções contra bots utilizando o `puppeteer-extra-plugin-stealth`.
- **Avaliação Inteligente com IA:** Integra-se com modelos de IA (OpenAI, Gemini, etc.) para analisar os resultados extraídos e escolher a melhor opção com base nas suas preferências (ex: dublado em Português, resolução 1080p, etc).
- **Integração Direta com o Deluge:** Detecta automaticamente as credenciais do Deluge rodando localmente (ou via configuração) e adiciona os torrents aprovados diretamente para a fila de download.
- **Interface Web em Tempo Real (SSE):** Acompanhe o progresso do agente, o status das buscas e os logs de decisão da IA ao vivo através de uma interface web responsiva utilizando Server-Sent Events.
- **Gerenciamento de Fila de Buscas:** Organiza as buscas de forma sequencial para não sobrecarregar o hardware do servidor, otimizando o uso de CPU e RAM.
- **Sistema de Cache (Stale-While-Revalidate):** Otimiza a comunicação entre o banco de dados e o frontend, garantindo que a interface permaneça rápida e fluida mesmo com histórico longo.
- **Monitoramento de Armazenamento:** Conta com uma página dedicada à verificação de disco/armazenamento do servidor.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express
- **Automação/Scraping:** Puppeteer, Puppeteer Stealth
- **Banco de Dados:** SQLite3 com ORM Sequelize
- **Frontend:** HTML, CSS e Vanilla JS

## 📦 Instalação e Execução

### 1. Instalar as Dependências
Certifique-se de ter o [Node.js](https://nodejs.org/) instalado (versão 18+ recomendada).
```bash
npm install
```

### 2. Iniciar o Agente
```bash
npm start
```
O servidor será iniciado por padrão na porta `4182` (ou na porta definida em seu ambiente).  
Acesse a interface pelo navegador: `http://localhost:4182`

## 🐧 Pré-requisitos Específicos para Linux (VPS/WSL/DietPi)

Caso esteja rodando o agente em um ambiente Linux puramente terminal e encontre erros relacionados à inicialização do navegador Chrome do Puppeteer (como `libgobject-2.0.so.0 is missing`), você precisa instalar as dependências essenciais de interface gráfica do sistema.

Execute o comando abaixo no terminal:

```bash
sudo apt-get update && sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0
```

> **Nota:** O sistema é inteligente o suficiente para tentar detectar o binário do Chromium nativo do sistema operacional (como em distribuições DietPi/ARM) caso o navegador interno do Puppeteer não funcione.

## 🔄 Rodando em Background com PM2

Para manter o agente rodando em segundo plano e reiniciá-lo automaticamente caso o servidor reinicie, recomendamos o uso do **PM2**.

### Instalar o PM2
```bash
npm install -g pm2
```

### Iniciar o Agente
Na pasta do projeto, execute:
```bash
pm2 start server.js --name "busca-torrent-ia"
```

### Configurar para iniciar com o sistema
```bash
pm2 startup
pm2 save
```

### Monitorar Logs
```bash
pm2 logs busca-torrent-ia
```

## ⚠️ Isenção de Responsabilidade

Este sistema é **livre para todos os usos** e foi criado exclusivamente para **testes de ideias e estudos** de automação, web scraping e integração com Inteligência Artificial.

- **Use por sua conta e risco:** O autor não se responsabiliza pelo uso indevido da ferramenta, pelas consequências de burlar proteções contra bots, ou pelos arquivos de terceiros processados através desta ferramenta.
- O projeto é **apenas um motor de busca automatizado**. Não hospedamos, não disponibilizamos e não nos responsabilizamos pelo teor dos torrents baixados pelo usuário.
