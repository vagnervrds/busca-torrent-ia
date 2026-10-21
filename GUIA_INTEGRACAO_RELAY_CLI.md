# Guia de Integração: Túnel Relay & Hunter CLI em Python

Este guia orienta como utilizar o **Servidor Proxy Relay** (documentado em `flask proposta/doc/RELAY_TUNNEL_GUIA.md`) para conectar remotamente à aplicação **Busca Torrent IA**, permitindo enviar torrents para download, acompanhar status em tempo real, disparar buscas inteligentes com IA e gerenciar configurações sem a necessidade de abrir portas no roteador (NAT/CGNAT).

---

## 1. Visão Geral da Arquitetura

```
+───────────────────────+          +────────────────────────+          +────────────────────────+
|   Hunter CLI (Python) |          |  Servidor Proxy Relay  |          |  Busca Torrent IA      |
|  (Notebook / Remoto)  |          | (https://seu-relay.com)|          |   (Servidor Local)     |
+───────────────────────+          +────────────────────────+          +────────────────────────+
           │                                   │                                   │
           │ 1. POST /relay/<uid>/webhook      │                                   │
           ├──────────────────────────────────►│                                   │
           │    {"action": "add_torrent", ...} │                                   │
           │                                   │ 2. Push Instantâneo via SSE       │
           │                                   │    GET /relay/<uid>/events        │
           │                                   ├──────────────────────────────────►│
           │                                   │                                   │
           │                                   │                                   │ 3. Executa comando:
           │                                   │                                   │    - Deluge (Download)
           │                                   │                                   │    - Agente IA (Busca)
           │                                   │                                   │    - SQLite (Config)
           │                                   │                                   │
           │                                   │ 4. POST /relay/<uid>/webhook/resp │
           │                                   │◄──────────────────────────────────┤
           │ 5. GET /relay/<uid>/poll          │                                   │
           │◄──────────────────────────────────┤                                   │
           │    {"result": { ... }}            │                                   │
```

---

## 2. Configuração na Interface Web (URLs e Credenciais do Sistema)

Na interface web do **Busca Torrent IA**, acesse a aba **Configurações do Sistema**:

### A. Túnel Relay & Acesso Remoto (Card 4)
* **URL do Servidor Relay:** Vem configurada com valor genérico (`https://relay.exemplo.com`). Altere para a URL real da sua VPS ou servidor (ex: `https://seu-dominio-proposta.com`).
* **Token de Acesso (Bearer Token):** Token cadastrado no servidor Relay para autenticação segura.
* **UID do Túnel:** Identificador alfanumérico exclusivo para sua máquina (ex: `hunter_torrent_local`).
* **URL de Destino Local:** Padrão `http://localhost:4182`.
* **Ativar Túnel Automaticamente:** Ativa a escuta contínua de SSE no startup do servidor.
* **Botão "Testar Conexão":** Valida o token e a conectividade antes de salvar.
* **Botão "Conectar / Desconectar":** Inicia ou pausa o túnel imediatamente.

### B. Provedor, Modelo e Credenciais de IA (Card 1)
* **Provedor de IA:** OpenAI Compatible (Gemini / OpenAI / Ollama) ou Anthropic (Claude).
* **Modelo da IA:** Ex: `gemini-3-flash`, `claude-3-5-sonnet`, `gpt-4o-mini`.
* **URL Base da API:** URL do gateway ou endpoint da API de IA (ex: `http://localhost:8045/v1`).
* **Token de Acesso (API Key):** Chave de autenticação do modelo de IA.
* **Botão "Testar Conexão":** Realiza um ping com pergunta de teste para o modelo.

### C. Conexão e Credenciais do Deluge Web (Card 3)
* **Host do Deluge:** `localhost`, `127.0.0.1` ou IP da sua máquina/servidor.
* **Porta Web:** Porta da interface web do Deluge (Padrão: `8112`).
* **Senha do Deluge:** Senha do Deluge Web (Padrão: `deluge`).
* **Botão "Testar Conexão Deluge":** Valida a autenticação no cliente torrent.

---

## 3. Utilização do CLI em Python (`hunter_cli.py`)

### 3.1. Modo Menu Interativo (Basta executar sem argumentos)

Ao rodar apenas:
```bash
python hunter_cli.py
```
O sistema abre diretamente um **Menu Interativo Completo** numerado no terminal:

```text
  +=============================================================+
  |    >> HUNTER TORRENT IA -- CLI DE CONTROLE & TUNEL RELAY <<  |
  +=============================================================+
  Modo Conexao: RELAY (TUNEL SSE) -> https://relay.exemplo.com (UID: hunter_torrent_local)
  -------------------------------------------------------------
  [1] DOWNLOADS E TORRENTS (DELUGE)
  [1]  Listar torrents ativos (progresso, velocidade, status)
  [2]  Enviar torrent para download (Magnet Link ou URL)
  [3]  Pausar um torrent
  [4]  Retomar um torrent
  [5]  Remover um torrent da fila

  [2] BUSCAS AUTONOMAS COM IA
  [6]  Iniciar nova busca autonoma com IA
  [7]  Ver historico de buscas recentes
  [8]  Ver detalhes, notas e torrent aprovado de uma busca

  [3] CONFIGURACOES DE IA & SISTEMA
  [9]  Visualizar configuracoes ativas de IA e sistema
  [10] Alterar parametros de IA (Modelo, Idioma, Resolucao)
  [11] Testar conexao com a API de IA

  [4] TUNEL RELAY & CONECTIVIDADE
  [12] Verificar status do Tunel Relay
  [13] Testar conectividade com o Servidor Relay
  [14] Configuracoes do CLI / Modo de Conexao (Assistente Setup)

  [0]  Sair do Hunter CLI
  -------------------------------------------------------------
Escolha uma opção [0-14]: 
```

Você pode escolher qualquer opção digitando o número correspondente. Ao concluir a ação, o CLI aguarda um toque em `ENTER` e retorna automaticamente ao menu!

---

### 3.2. Assistente Interativo de Configuração (`setup`)

O assistente solicitará:
1. **Modo de Operação:** `relay` (para acesso remoto via túnel) ou `direct` (para acesso local direto `http://localhost:4182`).
2. **URL do Servidor Relay:** Ex: `https://seu-dominio.com`
3. **Token de Acesso Bearer:** Seu token do Relay
4. **UID do Túnel:** O mesmo UID configurado no Busca Torrent IA (ex: `hunter_torrent_local`)

As configurações são salvas automaticamente em `hunter_cli_config.json`.

---

## 4. Exemplos de Comandos do CLI

### 4.1. Gerenciamento de Downloads e Torrents

* **Listar todos os torrents ativos e em download:**
  ```bash
  python hunter_cli.py torrent list
  ```
  *(Exibe tabela com ID, Nome, Status, Progresso %, Velocidade e Tamanho)*

* **Enviar torrent (Magnet Link) para download:**
  ```bash
  python hunter_cli.py torrent add "magnet:?xt=urn:btih:XXXXXX&dn=Filme..."
  ```

* **Enviar torrent via URL HTTP:**
  ```bash
  python hunter_cli.py torrent add "https://site-torrent.com/download/filme.torrent"
  ```

* **Pausar um download:**
  ```bash
  python hunter_cli.py torrent pause <ID_DO_TORRENT>
  ```

* **Retomar um download:**
  ```bash
  python hunter_cli.py torrent resume <ID_DO_TORRENT>
  ```

* **Remover um torrent da fila:**
  ```bash
  python hunter_cli.py torrent remove <ID_DO_TORRENT>
  ```

* **Remover o torrent e apagar os arquivos físicos do disco:**
  ```bash
  python hunter_cli.py torrent remove <ID_DO_TORRENT> --with-data
  ```

---

### 4.2. Buscas com Inteligência Artificial

* **Iniciar uma nova busca autônoma de IA:**
  ```bash
  python hunter_cli.py search create "Duna Parte 2 1080p"
  ```
  *(O agente autônomo navegará nos sites de torrent configurados, avaliará os metadados com IA e enviará o melhor torrent aprovado diretamente ao Deluge)*

* **Listar buscas de IA recentes:**
  ```bash
  python hunter_cli.py search list --limit 15
  ```

* **Acompanhar status e avaliações de uma busca:**
  ```bash
  python hunter_cli.py search status <ID_DA_BUSCA>
  ```

---

### 4.3. Configurações de IA e Sistema

* **Consultar as configurações atuais do servidor:**
  ```bash
  python hunter_cli.py config show
  ```

* **Alterar modelo e parâmetros de IA remotamente:**
  ```bash
  python hunter_cli.py config set --provider openai --model gemini-3-flash --audio "Português (Dublado)" --resolution 1080p
  ```

* **Atualizar chave de API de IA:**
  ```bash
  python hunter_cli.py config set --token "AIzaSy..."
  ```

* **Testar conectividade com a API de IA:**
  ```bash
  python hunter_cli.py config test-ai
  ```

---

### 4.4. Diagnóstico do Túnel Relay

* **Verificar status da conexão do túnel:**
  ```bash
  python hunter_cli.py relay status
  ```

* **Testar conectividade com o servidor Relay:**
  ```bash
  python hunter_cli.py relay test
  ```

---

## 5. Sobrescrita Dinâmica via Argumentos

Você pode alternar entre ambientes ou testar conexões sem alterar o arquivo de configuração passando parâmetros na linha de comando:

```bash
# Executar comando diretamente pela rede local
python hunter_cli.py --mode direct --direct-url http://192.168.1.100:4182 torrent list

# Executar comando através de outro túnel Relay
python hunter_cli.py --mode relay --uid dev_outro_pc torrent list
```
