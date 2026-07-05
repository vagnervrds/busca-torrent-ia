# Busca Torrent IA

Agente de busca de torrents utilizando Inteligência Artificial, SQLite e Puppeteer.

## Pré-requisitos (Linux)

Caso esteja rodando o agente em um ambiente Linux (como VPS, servidor SSH ou WSL) e encontre erros relacionados à inicialização do navegador Chrome do Puppeteer (por exemplo, erros de bibliotecas compartilhadas ausentes como `libgobject-2.0.so.0`), você deve instalar as dependências de sistema necessárias executando o comando abaixo no terminal do servidor:

```bash
sudo apt-get update && sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0
```
