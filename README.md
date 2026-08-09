# Busca Torrent IA 🤖 🎬

O **Busca Torrent IA** (T-Hunter AI) é um agente inteligente e automatizado que utiliza Inteligência Artificial, Puppeteer e SQLite para buscar, analisar e gerenciar downloads de torrents de forma autônoma.

Ele foi projetado para rodar em servidores (como DietPi, Raspberry Pi, VPS ou localmente) e automatizar o processo de encontrar o melhor torrent para o seu gosto (idioma, resolução) e enviá-lo diretamente para o seu cliente de torrent.

---

## 🚀 Funcionalidades Principais

- **Busca Automatizada com Puppeteer:** Navega em sites de torrent simulando comportamento humano e burlando proteções contra bots utilizando o `puppeteer-extra-plugin-stealth`.
- **Avaliação Inteligente com IA:** Integra-se com modelos de IA (OpenAI, Gemini, etc.) para analisar os resultados extraídos e escolher a melhor opção com base nas suas preferências (ex: resolução 1080p, 4K, etc).
- **Filtro Avançado "Somente Dublado":** Suporte aprimorado para áudio em Português-BR. Quando configurado como "somente dublado", o classificador prioriza títulos em português, o avaliador da IA realiza checagem rigorosa de áudio PT-BR (desconsiderando rótulos genéricos de "Dual Áudio" sem comprovação de idioma) e o gerente de qualidade mantém a busca ativa até que um arquivo com áudio dublado seja confirmado.
- **Integração Direta com o Deluge:** Detecta automaticamente as credenciais do Deluge rodando localmente (ou via configuração) e adiciona os torrents aprovados diretamente para a fila de download, invalidando caches relacionados para atualização imediata.
- **Interface Web em Tempo Real (SSE Global):** Acompanhe o progresso do agente, status das buscas e logs de decisão da IA ao vivo. Conta com um canal SSE global que sincroniza o histórico, badges e contadores da barra lateral instantaneamente para todos os clientes conectados.
- **Gerenciador de Armazenamento Redesenhado:** Página administrativa redesenhada com Tailwind CSS sob uma estética moderna e limpa, oferecendo:
  - **Navegador de Arquivos:** Tabela interativa para navegar pelas pastas de downloads do Deluge com suporte a breadcrumbs dinâmicos (compatível com Linux e Windows).
  - **Visualização de Blocos:** Gráfico interativo Treemap (ECharts) para localizar arquivos grandes visualmente.
  - **Exclusão Física em Lote:** Permite selecionar múltiplos arquivos/pastas simultaneamente por meio de checkboxes para exclusão definitiva do disco com modal de confirmação detalhado.
  - **Barra de Espaço em Disco:** Exibição em tempo real do espaço ocupado por downloads do T-Hunter, outros arquivos e espaço livre.
- **Resiliência e Retomada Automática:** Após reiniciar o servidor, o sistema agenda para 60 segundos uma retomada automática de todas as buscas pendentes ou não concluídas no banco de dados, enfileirando-as por ordem de recência.
- **Controle de Processo Remoto:** Botões dedicados nas configurações para reiniciar ou desligar o servidor Node.js de forma segura com área de exibição de logs de falha na própria UI.
- **Cache SWR (Stale-While-Revalidate) de Alta Performance:** Otimização de cache no servidor (evitando queries lentas de contagem e revalidando chaves em background de forma assíncrona) combinada com cache local (`localStorage`) no navegador para carregamento imediato de buscas e status.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express, Worker Threads (mapeamento paralelo de arquivos)
- **Automação/Scraping:** Puppeteer, Puppeteer Stealth
- **Banco de Dados:** SQLite3 com ORM Sequelize
- **Frontend:** HTML, Vanilla JS, Tailwind CSS, Phosphor Icons, ECharts (gráficos dinâmicos)

---

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

---

## 🐧 Pré-requisitos Específicos para Linux (VPS/WSL/DietPi)

Caso esteja rodando o agente em um ambiente Linux puramente terminal e encontre erros relacionados à inicialização do navegador Chrome do Puppeteer (como `libgobject-2.0.so.0 is missing`), você precisa instalar as dependências essenciais de interface gráfica do sistema.

Execute o comando abaixo no terminal:

```bash
sudo apt-get update && sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0
```

> **Nota:** O sistema é inteligente o suficiente para tentar detectar o binário do Chromium nativo do sistema operacional (como em distribuições DietPi/ARM) caso o navegador interno do Puppeteer não funcione.

---

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

---

## ⚠️ Isenção de Responsabilidade

Este sistema é **livre para todos os usos** e foi criado exclusivamente para **testes de ideias e estudos** de automação, web scraping e integração com Inteligência Artificial.

- **Use por sua conta e risco:** O autor não se responsabiliza pelo uso indevido da ferramenta, pelas consequências de burlar proteções contra bots, ou pelos arquivos de terceiros processados através desta ferramenta.
- O projeto é **apenas um motor de busca automatizado**. Não hospedamos, não disponibilizamos e não nos responsabilizamos pelo teor dos torrents baixados pelo usuário.
