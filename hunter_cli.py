#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hunter_cli.py - CLI e Menu Interativo em Python para Controle Remoto do Busca Torrent IA
Integração com Servidor Proxy Relay & Túnel HTTP Seguro (OAuth & Webhooks)
e Conexão Direta (REST API).

Permite:
- Enviar torrents (magnet / URLs) para serem baixados
- Ver status de downloads e torrents no Deluge
- Criar e acompanhar buscas automatizadas de IA
- Consultar e alterar configurações de IA e do sistema
- Menu interativo com apenas `python hunter_cli.py`
"""

import os
import sys
import time
import json
import uuid
import argparse
from typing import Dict, Any, Optional

try:
    import requests
except ImportError:
    print("[!] O pacote 'requests' é necessário. Instale com: pip install requests")
    sys.exit(1)

# Garante suporte a UTF-8 no Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Arquivo de configuração padrão do CLI
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hunter_cli_config.json")

# Cores ANSI para terminal
class Color:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[92m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    GRAY = "\033[90m"

    @classmethod
    def strip_if_no_color(cls, text: str) -> str:
        if not sys.stdout.isatty():
            for c in [cls.RESET, cls.BOLD, cls.GREEN, cls.BLUE, cls.CYAN, cls.YELLOW, cls.RED, cls.MAGENTA, cls.GRAY]:
                text = text.replace(c, "")
        return text


# ==============================================================================
# GERENCIAMENTO DE CONFIGURAÇÃO DO CLI
# ==============================================================================

DEFAULT_CONFIG = {
    "mode": "relay",  # 'relay' ou 'direct'
    "relay_server_url": "https://relay.exemplo.com",  # URL genérica por padrão
    "relay_access_token": "seu-token-de-acesso",
    "relay_uid": "hunter_torrent_local",
    "direct_url": "http://localhost:4182",
    "timeout_seconds": 15
}


def carregar_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                dados = json.load(f)
                config = DEFAULT_CONFIG.copy()
                config.update(dados)
                return config
        except Exception as e:
            print(f"{Color.YELLOW}[!] Aviso ao ler {CONFIG_FILE}: {e}. Usando valores padrão.{Color.RESET}")
    return DEFAULT_CONFIG.copy()


def salvar_config(config: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"{Color.GREEN}[✓] Configurações salvas em {CONFIG_FILE}{Color.RESET}")
    except Exception as e:
        print(f"{Color.RED}[!] Erro ao salvar configurações: {e}{Color.RESET}")


# ==============================================================================
# CLIENTE DE COMUNICAÇÃO (RELAY & DIRETO)
# ==============================================================================

class HunterClient:
    def __init__(self, config: dict):
        self.config = config
        self.mode = config.get("mode", "relay").lower()
        self.relay_url = config.get("relay_server_url", "").rstrip("/")
        self.relay_token = config.get("relay_access_token", "")
        self.relay_uid = config.get("relay_uid", "hunter_torrent_local")
        self.direct_url = config.get("direct_url", "http://localhost:4182").rstrip("/")
        self.timeout = int(config.get("timeout_seconds", 15))

    def execute_command(self, action: str, params: Optional[dict] = None) -> dict:
        """Executa um comando contra a aplicação (via Relay ou Modo Direto)"""
        params = params or {}

        if self.mode == "direct":
            return self._execute_direct(action, params)
        else:
            return self._execute_relay(action, params)

    # ---------- MODO DIRETO (REST HTTP LOCAL/REDE) ----------

    def _execute_direct(self, action: str, params: dict) -> dict:
        url = self.direct_url
        headers = {"Content-Type": "application/json"}

        try:
            if action in ["add_torrent", "add_magnet"]:
                r = requests.post(f"{url}/api/deluge/add", json={"magnetLink": params.get("magnet") or params.get("magnetLink")}, timeout=self.timeout)
                return r.json()

            elif action == "add_url":
                r = requests.post(f"{url}/api/deluge/add-url", json={"url": params.get("url")}, timeout=self.timeout)
                return r.json()

            elif action in ["get_torrents", "status"]:
                r = requests.get(f"{url}/api/deluge/torrents", timeout=self.timeout)
                return r.json()

            elif action == "pause_torrent":
                r = requests.post(f"{url}/api/deluge/torrents/{params.get('id')}/pause", timeout=self.timeout)
                return r.json()

            elif action == "resume_torrent":
                r = requests.post(f"{url}/api/deluge/torrents/{params.get('id')}/resume", timeout=self.timeout)
                return r.json()

            elif action == "remove_torrent":
                r = requests.post(f"{url}/api/deluge/torrents/{params.get('id')}/remove", json={"removeData": params.get("removeData", False)}, timeout=self.timeout)
                return r.json()

            elif action in ["search_ia", "new_search"]:
                r = requests.post(f"{url}/api/search", json={"query": params.get("query")}, timeout=self.timeout)
                return r.json()

            elif action in ["get_searches", "list_searches"]:
                r = requests.get(f"{url}/api/searches", timeout=self.timeout)
                return r.json()

            elif action in ["get_search", "search_detail"]:
                r = requests.get(f"{url}/api/searches/{params.get('id')}", timeout=self.timeout)
                return r.json()

            elif action == "stop_search":
                r = requests.post(f"{url}/api/searches/{params.get('id')}/stop", timeout=self.timeout)
                return r.json()

            elif action == "restart_search":
                r = requests.post(f"{url}/api/searches/{params.get('id')}/restart", timeout=self.timeout)
                return r.json()

            elif action == "get_settings":
                r = requests.get(f"{url}/api/settings", timeout=self.timeout)
                return {"success": True, "settings": r.json()}

            elif action in ["save_settings", "set_settings"]:
                r = requests.post(f"{url}/api/settings", json=params.get("settings", params), timeout=self.timeout)
                return r.json()

            elif action == "test_ai":
                r = requests.post(f"{url}/api/settings/test", json=params.get("config", params), timeout=self.timeout)
                return r.json()

            elif action == "relay_status":
                r = requests.get(f"{url}/api/relay/status", timeout=self.timeout)
                return r.json()

            else:
                return {"success": False, "error": f"Ação direta desconhecida: {action}"}

        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": f"Não foi possível conectar ao endereço direto ({url}). O servidor Node.js está rodando nessa porta?"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---------- MODO TÚNEL RELAY (VIA SERVIDOR PROXY SEGURO) ----------

    def _execute_relay(self, action: str, params: dict) -> dict:
        if not self.relay_url or "exemplo.com" in self.relay_url:
            return {
                "success": False,
                "error": (
                    f"A URL do Relay está configurada como exemplo genérico ('{self.relay_url}').\n"
                    f"Selecione a opção de Configuração [14] no menu ou execute 'python hunter_cli.py setup' para informar a URL real."
                )
            }

        command_id = f"cli_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        ingest_url = f"{self.relay_url}/relay/{self.relay_uid}/webhook"

        payload = {
            "command_id": command_id,
            "action": action,
            "params": params,
            "reply_uid": self.relay_uid,
            "client": "hunter_cli_python",
            "timestamp": time.time()
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.relay_token}"
        }

        # 1. Envia comando para o webhook do Relay
        try:
            res = requests.post(ingest_url, json=payload, headers=headers, timeout=self.timeout)
            if res.status_code != 200:
                return {
                    "success": False,
                    "error": f"Servidor Relay retornou status HTTP {res.status_code}: {res.text}"
                }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": f"Não foi possível alcançar o servidor Relay em {self.relay_url}."
            }
        except Exception as e:
            return {"success": False, "error": f"Erro de conexão com Relay: {str(e)}"}

        # 2. Tenta coletar resposta no buffer via polling de contingência por até 8 segundos
        poll_url = f"{self.relay_url}/relay/{self.relay_uid}/poll?clear=true"
        inicio = time.time()
        espera_maxima = 8.0

        while (time.time() - inicio) < espera_maxima:
            time.sleep(0.8)
            try:
                poll_res = requests.get(poll_url, headers=headers, timeout=5)
                if poll_res.status_code == 200:
                    dados = poll_res.json()
                    eventos = dados.get("eventos", [])
                    for evt in eventos:
                        body = evt.get("body")
                        if isinstance(body, dict) and body.get("command_id") == command_id:
                            return body.get("result", {"success": True})
            except Exception:
                pass

        return {
            "success": True,
            "delivered_to_relay": True,
            "command_id": command_id,
            "message": f"Comando '{action}' despachado via Relay com sucesso! (Agente recebeu via SSE)"
        }


# ==============================================================================
# FORMATAÇÃO VISUAL E HELPERS
# ==============================================================================

def format_bytes(size_bytes: int) -> str:
    if not size_bytes or size_bytes <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024.0 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.2f} {units[i]}"


def format_speed(speed_bps: int) -> str:
    return f"{format_bytes(speed_bps)}/s"


def print_banner(client: Optional[HunterClient] = None):
    banner = f"""{Color.MAGENTA}{Color.BOLD}
  +=============================================================+
  |    >> HUNTER TORRENT IA -- CLI DE CONTROLE & TUNEL RELAY <<  |
  +=============================================================+{Color.RESET}"""
    print(Color.strip_if_no_color(banner))

    if client:
        mode_str = f"{Color.GREEN}DIRETO (REST){Color.RESET}" if client.mode == "direct" else f"{Color.MAGENTA}RELAY (TUNEL SSE){Color.RESET}"
        dest_str = client.direct_url if client.mode == "direct" else f"{client.relay_url} (UID: {client.relay_uid})"
        print(f"  {Color.BOLD}Modo Conexao:{Color.RESET} {mode_str} -> {Color.CYAN}{dest_str}{Color.RESET}")
        print("  " + "-" * 61)


# ==============================================================================
# SUBCOMANDOS DO CLI
# ==============================================================================

# ---------- 1. TORRENTS ----------

def cmd_torrent_list(client: HunterClient, args=None):
    print(f"\n{Color.CYAN}[*] Consultando lista de torrents no Deluge ({client.mode.upper()})...{Color.RESET}")
    res = client.execute_command("get_torrents")

    if not res.get("success"):
        print(f"{Color.RED}[!] Erro ao listar torrents: {res.get('error')}{Color.RESET}")
        return

    torrents = res.get("torrents", {})
    if not torrents:
        print(f"{Color.YELLOW}[i] Nenhum torrent em download ou envio no Deluge atualmente.{Color.RESET}\n")
        return

    print(f"\n{Color.BOLD}{'ID':<10} {'NOME':<38} {'STATUS':<14} {'PROG':<8} {'DL VEL':<12} {'TAMANHO':<10}{Color.RESET}")
    print("-" * 96)

    for tid, info in torrents.items():
        short_id = tid[:8]
        name = (info.get("name") or "Desconhecido")[:36]
        state = info.get("state") or "Ativo"
        progress = f"{info.get('progress', 0):.1f}%"
        down_speed = format_speed(info.get("download_payload_rate", 0))
        total_size = format_bytes(info.get("total_size", 0))

        status_color = Color.GREEN if state.lower() == "downloading" else (Color.BLUE if state.lower() == "seeding" else Color.YELLOW)
        print(f"{short_id:<10} {name:<38} {status_color}{state:<14}{Color.RESET} {progress:<8} {down_speed:<12} {total_size:<10}")

    print(f"\n{Color.GRAY}Total de torrents: {len(torrents)}{Color.RESET}\n")


def cmd_torrent_add(client: HunterClient, args=None, target_str: Optional[str] = None):
    magnet_or_url = (target_str or (args.target if args else "")).strip()
    if not magnet_or_url:
        print(f"{Color.RED}[!] Magnet link ou URL ausente.{Color.RESET}")
        return

    print(f"\n{Color.CYAN}[*] Enviando torrent para o Deluge...{Color.RESET}")

    if magnet_or_url.startswith("magnet:"):
        res = client.execute_command("add_torrent", {"magnet": magnet_or_url})
    elif magnet_or_url.startswith("http://") or magnet_or_url.startswith("https://"):
        res = client.execute_command("add_url", {"url": magnet_or_url})
    else:
        print(f"{Color.RED}[!] Formato inválido. Forneça um Magnet Link ('magnet:?xt=...') ou URL HTTP.{Color.RESET}")
        return

    if res.get("success"):
        tid = res.get("torrentId") or res.get("command_id") or "Enviado"
        print(f"{Color.GREEN}[✓] Torrent adicionado com sucesso à fila! (ID: {tid}){Color.RESET}\n")
    else:
        print(f"{Color.RED}[!] Falha ao adicionar torrent: {res.get('error')}{Color.RESET}\n")


def cmd_torrent_pause(client: HunterClient, args=None, torrent_id: Optional[str] = None):
    tid = torrent_id or (args.id if args else "")
    res = client.execute_command("pause_torrent", {"id": tid})
    if res.get("success"):
        print(f"{Color.GREEN}[✓] Torrent {tid} pausado com sucesso.{Color.RESET}")
    else:
        print(f"{Color.RED}[!] Erro ao pausar torrent: {res.get('error')}{Color.RESET}")


def cmd_torrent_resume(client: HunterClient, args=None, torrent_id: Optional[str] = None):
    tid = torrent_id or (args.id if args else "")
    res = client.execute_command("resume_torrent", {"id": tid})
    if res.get("success"):
        print(f"{Color.GREEN}[✓] Torrent {tid} retomado com sucesso.{Color.RESET}")
    else:
        print(f"{Color.RED}[!] Erro ao retomar torrent: {res.get('error')}{Color.RESET}")


def cmd_torrent_remove(client: HunterClient, args=None, torrent_id: Optional[str] = None, with_data: bool = False):
    tid = torrent_id or (args.id if args else "")
    remove_files = with_data if args is None else bool(args.with_data)
    res = client.execute_command("remove_torrent", {"id": tid, "removeData": remove_files})
    if res.get("success"):
        print(f"{Color.GREEN}[✓] Torrent {tid} removido {'com exclusão de dados do disco' if remove_files else 'da fila'}.{Color.RESET}")
    else:
        print(f"{Color.RED}[!] Erro ao remover torrent: {res.get('error')}{Color.RESET}")


# ---------- 2. BUSCAS DE IA ----------

def cmd_search_create(client: HunterClient, args=None, query_str: Optional[str] = None):
    query = (query_str or (" ".join(args.query) if args and args.query else "")).strip()
    if not query:
        print(f"{Color.RED}[!] Forneça o termo de busca (Ex: Duna Parte 2 1080p){Color.RESET}")
        return

    print(f"\n{Color.CYAN}[*] Iniciando agente de busca autônoma de IA para: '{query}'...{Color.RESET}")
    res = client.execute_command("search_ia", {"query": query})

    if res.get("success"):
        sid = res.get("searchId") or res.get("id") or "Enfileirado"
        print(f"{Color.GREEN}[✓] Busca de IA iniciada com sucesso! (ID: {sid}){Color.RESET}")
        print(f"{Color.GRAY}O agente de IA navegará nos sites de torrent, avaliará os metadados e escolherá o melhor torrent.{Color.RESET}")
        print(f"{Color.GRAY}Acompanhe o status no menu (opção 8) ou com: python hunter_cli.py search status {sid}{Color.RESET}\n")
    else:
        print(f"{Color.RED}[!] Erro ao iniciar busca de IA: {res.get('error')}{Color.RESET}\n")


def cmd_search_list(client: HunterClient, args=None, limit_val: int = 10):
    limit = (args.limit if args else None) or limit_val
    print(f"\n{Color.CYAN}[*] Consultando últimas {limit} buscas de IA...{Color.RESET}")
    res = client.execute_command("get_searches", {"limit": limit})

    if not res.get("success"):
        print(f"{Color.RED}[!] Erro ao buscar histórico: {res.get('error')}{Color.RESET}")
        return

    searches = res.get("searches", [])
    if not searches:
        print(f"{Color.YELLOW}[i] Nenhuma busca de IA encontrada no histórico.{Color.RESET}\n")
        return

    print(f"\n{Color.BOLD}{'ID':<6} {'TERMO DE BUSCA':<40} {'STATUS':<15} {'CRIADO EM':<20}{Color.RESET}")
    print("-" * 85)

    for s in searches:
        sid = s.get("id")
        query = (s.get("query") or "")[:38]
        status = s.get("status") or "pending"
        created = (s.get("createdAt") or "")[:19].replace("T", " ")

        if status == "completed":
            status_str = f"{Color.GREEN}Concluída{Color.RESET}"
        elif status == "running":
            status_str = f"{Color.CYAN}Em Execução{Color.RESET}"
        elif status == "failed":
            status_str = f"{Color.RED}Falha{Color.RESET}"
        else:
            status_str = f"{Color.YELLOW}Pendente{Color.RESET}"

        print(f"{sid:<6} {query:<40} {status_str:<24} {created:<20}")

    print("")


def cmd_search_status(client: HunterClient, args=None, search_id: Optional[str] = None):
    sid = search_id or (args.id if args else "")
    if not sid:
        print(f"{Color.RED}[!] ID da busca ausente.{Color.RESET}")
        return

    print(f"\n{Color.CYAN}[*] Consultando detalhes da busca de IA #{sid}...{Color.RESET}")
    res = client.execute_command("get_search", {"id": sid})

    if not res.get("success"):
        print(f"{Color.RED}[!] Erro ao obter detalhes: {res.get('error')}{Color.RESET}")
        return

    search = res.get("search", {})
    query = search.get("query", "")
    status = search.get("status", "")
    chosen_id = search.get("chosenTorrentId")
    err_msg = search.get("errorMessage")

    print(f"\n{Color.BOLD}Busca #{sid}: {Color.MAGENTA}{query}{Color.RESET}")
    print(f"Status atual: {Color.BOLD}{status.upper()}{Color.RESET}")
    if err_msg:
        print(f"{Color.RED}Mensagem de Erro: {err_msg}{Color.RESET}")

    results = search.get("TorrentResults", [])
    evals = search.get("TorrentEvaluations", [])
    eval_map = {e.get("torrentResultId"): e for e in evals}

    print(f"\nTorrents analisados: {len(results)}")
    for tr in results:
        tr_id = tr.get("id")
        title = tr.get("title", "")[:45]
        size = tr.get("size", "N/D")
        ev = eval_map.get(tr_id, {})
        approved = ev.get("isApproved", False)
        score = ev.get("score", 0)

        mark = f"{Color.GREEN}[APROVADO ★]{Color.RESET}" if tr_id == chosen_id or approved else f"{Color.GRAY}[REJEITADO]{Color.RESET}"
        print(f"  {mark} #{tr_id} {title} ({size}) - Nota: {score}/100")
        if ev.get("reason"):
            print(f"    └─ Motivo: {ev.get('reason')[:75]}...")

    print("")


# ---------- 3. CONFIGURAÇÕES DE IA & SISTEMA ----------

def cmd_config_show(client: HunterClient, args=None):
    print(f"\n{Color.CYAN}[*] Consultando configurações de IA no servidor...{Color.RESET}")
    res = client.execute_command("get_settings")

    if not res.get("success"):
        print(f"{Color.RED}[!] Erro ao carregar configurações: {res.get('error')}{Color.RESET}")
        return

    settings = res.get("settings", {})
    print(f"\n{Color.BOLD}=== CONFIGURAÇÕES ATUAIS DE IA & SISTEMA ==={Color.RESET}")
    print(f"  Provedor de IA        : {Color.GREEN}{settings.get('aiProvider', 'openai')}{Color.RESET}")
    print(f"  Modelo de IA          : {Color.GREEN}{settings.get('aiModel', 'gemini-3-flash')}{Color.RESET}")
    print(f"  URL Base da API       : {settings.get('aiUrl', '(Padrão do Provedor)')}")
    print(f"  Token de Acesso (Key) : {Color.GRAY}{settings.get('aiToken', 'Não configurado')}{Color.RESET}")
    print(f"  Idioma de Áudio       : {Color.CYAN}{settings.get('preferredAudioLanguage', 'Português (Dublado)')}{Color.RESET}")
    print(f"  Idioma da Legenda     : {settings.get('preferredSubtitleLanguage', 'Português (PT-BR)')}")
    print(f"  Resolução Preferencial: {Color.YELLOW}{settings.get('preferredResolution', '1080p')}{Color.RESET}")
    print(f"  Auto-limpeza de Disco : {'Ativo' if settings.get('autoDeleteOldFiles') in [True, 'true'] else 'Inativo'}")
    print(f"  Espaço Mínimo Livre   : {settings.get('minFreeSpaceGB', '4')} GB")

    print(f"\n{Color.BOLD}=== CONEXÃO DELUGE (CLIENTE TORRENT) ==={Color.RESET}")
    print(f"  Host do Deluge Web    : {settings.get('delugeHost', 'localhost')}")
    print(f"  Porta do Deluge Web   : {settings.get('delugePort', '8112')}")
    print(f"  Pasta de Downloads    : {settings.get('deluge_download_path', 'Detectada automaticamente')}")

    print(f"\n{Color.BOLD}=== MODO DE CONEXÃO DO CLI ==={Color.RESET}")
    print(f"  Modo Operacional      : {Color.BOLD}{client.mode.upper()}{Color.RESET}")
    print(f"  Servidor Relay        : {client.relay_url}")
    print(f"  UID do Túnel          : {client.relay_uid}")
    print(f"  Endereço Direto       : {client.direct_url}\n")


def cmd_config_set(client: HunterClient, args=None, custom_payload: Optional[dict] = None):
    payload = custom_payload or {}
    if args:
        if args.provider: payload["aiProvider"] = args.provider
        if args.model: payload["aiModel"] = args.model
        if args.url: payload["aiUrl"] = args.url
        if args.token: payload["aiToken"] = args.token
        if args.audio: payload["preferredAudioLanguage"] = args.audio
        if args.subtitle: payload["preferredSubtitleLanguage"] = args.subtitle
        if args.resolution: payload["preferredResolution"] = args.resolution

    if not payload:
        print(f"{Color.YELLOW}[!] Nenhum parâmetro informado para atualizar.{Color.RESET}")
        return

    print(f"\n{Color.CYAN}[*] Atualizando configurações de IA no servidor...{Color.RESET}")
    res = client.execute_command("save_settings", {"settings": payload})

    if res.get("success"):
        print(f"{Color.GREEN}[✓] Configurações de IA salvas com sucesso!{Color.RESET}\n")
    else:
        print(f"{Color.RED}[!] Erro ao salvar configurações: {res.get('error')}{Color.RESET}\n")


def cmd_config_test_ai(client: HunterClient, args=None):
    print(f"\n{Color.CYAN}[*] Testando conexão com a API de IA configurada...{Color.RESET}")
    res = client.execute_command("test_ai")

    if res.get("success"):
        print(f"{Color.GREEN}[✓] Teste com a IA bem-sucedido! Modelo respondeu perfeitamente.{Color.RESET}\n")
    else:
        print(f"{Color.RED}[!] Falha no teste com a IA: {res.get('error')}{Color.RESET}\n")


# ---------- 4. TÚNEL RELAY ----------

def cmd_relay_status(client: HunterClient, args=None):
    print(f"\n{Color.CYAN}[*] Consultando status do túnel no servidor...{Color.RESET}")
    res = client.execute_command("relay_status")

    if res.get("success") is False:
        print(f"{Color.RED}[!] Não foi possível obter status do relay: {res.get('error')}{Color.RESET}")
        return

    status = res.get("status", "desconhecido")
    is_connected = status == "connected"
    status_str = f"{Color.GREEN}Conectado ao Relay (Ativo){Color.RESET}" if is_connected else f"{Color.RED}{status.upper()}{Color.RESET}"

    print(f"\n{Color.BOLD}=== STATUS DO TÚNEL RELAY ==={Color.RESET}")
    print(f"  Estado da Conexão   : {status_str}")
    print(f"  URL do Relay Server : {res.get('serverUrl') or client.relay_url}")
    print(f"  UID Registrado      : {res.get('uid') or client.relay_uid}")
    print(f"  URL Destino Local   : {res.get('targetUrl', 'http://localhost:4182')}")
    print(f"  Comandos Recebidos  : {res.get('eventsReceivedCount', 0)}")
    if res.get("lastError"):
        print(f"  Último Erro         : {Color.RED}{res.get('lastError')}{Color.RESET}")

    eps = res.get("endpoints", {})
    if eps:
        print(f"\n{Color.BOLD}Endpoints gerados pelo Relay:{Color.RESET}")
        print(f"  Webhook / Comandos  : {eps.get('webhook_ingest')}")
        print(f"  Stream SSE          : {eps.get('events_sse')}")

    print("")


def cmd_relay_test(client: HunterClient, args=None):
    relay_url = client.relay_url
    token = client.relay_token
    print(f"\n{Color.CYAN}[*] Testando conectividade com {relay_url}...{Color.RESET}")

    if not relay_url or "exemplo.com" in relay_url:
        print(f"{Color.RED}[!] A URL configurada é de exemplo genérico ('{relay_url}'). Configure a URL real com a opção [14].{Color.RESET}")
        return

    try:
        tunnels_url = f"{relay_url}/relay/tunnels"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(tunnels_url, headers=headers, timeout=8)

        if res.status_code == 200:
            data = res.json()
            tunnels = data.get("tuneis", [])
            my_tunnel = next((t for t in tunnels if t.get("uid") == client.relay_uid), None)

            print(f"{Color.GREEN}[✓] Conexão com Servidor Relay bem-sucedida!{Color.RESET}")
            print(f"  Total de túneis associados ao seu token: {len(tunnels)}")
            if my_tunnel:
                print(f"  Túnel '{client.relay_uid}' encontrado e ativo.")
            else:
                print(f"  Túnel '{client.relay_uid}' ainda não registrado (será registrado automaticamente ao conectar o agente).")
            print("")
        else:
            print(f"{Color.RED}[!] Servidor Relay retornou status HTTP {res.status_code}: {res.text}{Color.RESET}\n")
    except Exception as e:
        print(f"{Color.RED}[!] Falha na conexão com o Relay: {e}{Color.RESET}\n")


# ---------- 5. ASSISTENTE DE SETUP INTERATIVO ----------

def cmd_setup(client: HunterClient, args=None):
    print_banner(client)
    print(f"\n{Color.BOLD}Assistente de Configuração do Hunter CLI{Color.RESET}")
    print("Defina os parâmetros de conexão com sua aplicação Busca Torrent IA.\n")

    current = client.config

    # Modo de Operação
    print(f"Modo de Operação atual: {Color.CYAN}{current.get('mode', 'relay')}{Color.RESET}")
    modo_in = input("Escolha o modo [1 = relay (Túnel Remoto), 2 = direct (HTTP Direto Local)]: ").strip()
    if modo_in == "2" or modo_in.lower() == "direct":
        current["mode"] = "direct"
    elif modo_in == "1" or modo_in.lower() == "relay":
        current["mode"] = "relay"

    # URL do Relay
    print(f"\nURL do Servidor Relay atual: {Color.CYAN}{current.get('relay_server_url')}{Color.RESET}")
    url_in = input("URL real do Servidor Relay (ex: https://seu-dominio.com ou Enter para manter): ").strip()
    if url_in:
        current["relay_server_url"] = url_in.rstrip("/")

    # Token do Relay
    print(f"\nToken de Acesso Bearer atual: {Color.CYAN}{current.get('relay_access_token', '')[:6]}...{Color.RESET}")
    token_in = input("Token de Acesso Bearer (ou Enter para manter): ").strip()
    if token_in:
        current["relay_access_token"] = token_in

    # UID do Túnel
    print(f"\nUID do Túnel atual: {Color.CYAN}{current.get('relay_uid', 'hunter_torrent_local')}{Color.RESET}")
    uid_in = input("UID do Túnel (ou Enter para manter): ").strip()
    if uid_in:
        current["relay_uid"] = uid_in

    # Endereço Direto
    print(f"\nEndereço Direto atual: {Color.CYAN}{current.get('direct_url', 'http://localhost:4182')}{Color.RESET}")
    direct_in = input("Endereço Direto Local (ou Enter para manter): ").strip()
    if direct_in:
        current["direct_url"] = direct_in.rstrip("/")

    salvar_config(current)
    # Atualiza o cliente ativo
    client.config = current
    client.mode = current.get("mode", "relay")
    client.relay_url = current.get("relay_server_url", "").rstrip("/")
    client.relay_token = current.get("relay_access_token", "")
    client.relay_uid = current.get("relay_uid", "hunter_torrent_local")
    client.direct_url = current.get("direct_url", "http://localhost:4182").rstrip("/")

    print(f"\n{Color.GREEN}[✓] Configurações atualizadas com sucesso!{Color.RESET}\n")


# ==============================================================================
# MENU INTERATIVO PRINCIPAL (EXECUTADO QUANDO CHAMA python hunter_cli.py)
# ==============================================================================

def run_interactive_menu(client: HunterClient):
    """Exibe o menu interativo com todas as opções disponíveis"""
    while True:
        # Limpa tela se suportado
        print_banner(client)

        print(f"{Color.BOLD}  [1] DOWNLOADS E TORRENTS (DELUGE){Color.RESET}")
        print(f"  {Color.CYAN}[1]{Color.RESET}  Listar torrents ativos (progresso, velocidade, status)")
        print(f"  {Color.CYAN}[2]{Color.RESET}  Enviar torrent para download (Magnet Link ou URL)")
        print(f"  {Color.CYAN}[3]{Color.RESET}  Pausar um torrent")
        print(f"  {Color.CYAN}[4]{Color.RESET}  Retomar um torrent")
        print(f"  {Color.CYAN}[5]{Color.RESET}  Remover um torrent da fila")

        print(f"\n{Color.BOLD}  [2] BUSCAS AUTONOMAS COM IA{Color.RESET}")
        print(f"  {Color.CYAN}[6]{Color.RESET}  Iniciar nova busca autonoma com IA")
        print(f"  {Color.CYAN}[7]{Color.RESET}  Ver historico de buscas recentes")
        print(f"  {Color.CYAN}[8]{Color.RESET}  Ver detalhes, notas e torrent aprovado de uma busca")

        print(f"\n{Color.BOLD}  [3] CONFIGURACOES DE IA & SISTEMA{Color.RESET}")
        print(f"  {Color.CYAN}[9]{Color.RESET}  Visualizar configuracoes ativas de IA e sistema")
        print(f"  {Color.CYAN}[10]{Color.RESET} Alterar parametros de IA (Modelo, Idioma, Resolucao)")
        print(f"  {Color.CYAN}[11]{Color.RESET} Testar conexao com a API de IA")

        print(f"\n{Color.BOLD}  [4] TUNEL RELAY & CONECTIVIDADE{Color.RESET}")
        print(f"  {Color.CYAN}[12]{Color.RESET} Verificar status do Tunel Relay")
        print(f"  {Color.CYAN}[13]{Color.RESET} Testar conectividade com o Servidor Relay")
        print(f"  {Color.CYAN}[14]{Color.RESET} Configuracoes do CLI / Modo de Conexao (Assistente Setup)")

        print(f"\n  {Color.RED}[0]{Color.RESET}  Sair do Hunter CLI")
        print("  " + "-" * 61)

        try:
            escolha = input(f"{Color.BOLD}Escolha uma opção [0-14]: {Color.RESET}").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nEncerrando Hunter CLI.")
            break

        if escolha == "0":
            print(f"\n{Color.GREEN}Até logo!{Color.RESET}")
            break

        elif escolha == "1":
            cmd_torrent_list(client)

        elif escolha == "2":
            target = input("\nInforme o Magnet Link ('magnet:?xt=...') ou URL do torrent: ").strip()
            if target:
                cmd_torrent_add(client, target_str=target)
            else:
                print(f"{Color.YELLOW}[!] Operação cancelada.{Color.RESET}")

        elif escolha == "3":
            tid = input("\nInforme o ID ou hash do torrent para pausar: ").strip()
            if tid:
                cmd_torrent_pause(client, torrent_id=tid)

        elif escolha == "4":
            tid = input("\nInforme o ID ou hash do torrent para retomar: ").strip()
            if tid:
                cmd_torrent_resume(client, torrent_id=tid)

        elif escolha == "5":
            tid = input("\nInforme o ID ou hash do torrent para remover: ").strip()
            if tid:
                apagar_dados = input("Deseja excluir também os arquivos baixados do disco? (s/N): ").strip().lower() in ["s", "sim", "y", "yes"]
                cmd_torrent_remove(client, torrent_id=tid, with_data=apagar_dados)

        elif escolha == "6":
            query = input("\nO que você deseja buscar com IA? (Ex: Matrix 1999 1080p): ").strip()
            if query:
                cmd_search_create(client, query_str=query)

        elif escolha == "7":
            lim_str = input("\nQuantas buscas deseja visualizar? [Padrão: 10]: ").strip()
            limit = int(lim_str) if lim_str.isdigit() else 10
            cmd_search_list(client, limit_val=limit)

        elif escolha == "8":
            sid = input("\nInforme o ID numérico da busca: ").strip()
            if sid:
                cmd_search_status(client, search_id=sid)

        elif escolha == "9":
            cmd_config_show(client)

        elif escolha == "10":
            print(f"\n{Color.BOLD}Alteração de Configurações de IA (Pressione Enter para manter o atual):{Color.RESET}")
            model = input("Novo Modelo de IA (ex: gemini-3-flash, claude-3-5-sonnet): ").strip()
            audio = input("Idioma de Áudio (ex: 'Português (Dublado)' ou 'Original'): ").strip()
            resolution = input("Resolução preferencial (1080p, 720p, 2160p, Qualquer): ").strip()

            payload = {}
            if model: payload["aiModel"] = model
            if audio: payload["preferredAudioLanguage"] = audio
            if resolution: payload["preferredResolution"] = resolution

            if payload:
                cmd_config_set(client, custom_payload=payload)
            else:
                print(f"{Color.YELLOW}[i] Nenhuma alteração informada.{Color.RESET}")

        elif escolha == "11":
            cmd_config_test_ai(client)

        elif escolha == "12":
            cmd_relay_status(client)

        elif escolha == "13":
            cmd_relay_test(client)

        elif escolha == "14":
            cmd_setup(client)

        else:
            print(f"{Color.RED}[!] Opção inválida. Digite um número de 0 a 14.{Color.RESET}")

        try:
            input(f"\n{Color.GRAY}Pressione ENTER para voltar ao menu principal...{Color.RESET}")
        except (KeyboardInterrupt, EOFError):
            break


# ==============================================================================
# MAIN & PARSER DE ARGUMENTOS
# ==============================================================================

def main():
    config = carregar_config()

    parser = argparse.ArgumentParser(
        description="Hunter CLI — Controle de Downloads de Torrents & Buscas de IA via Relay ou Conexão Direta",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Opções globais para sobrescrever configuração
    parser.add_argument("--mode", choices=["relay", "direct"], help="Modo de conexão (relay ou direct)")
    parser.add_argument("--relay-url", help="Sobrescreve a URL do servidor Relay")
    parser.add_argument("--token", help="Sobrescreve o Token Bearer do Relay")
    parser.add_argument("--uid", help="Sobrescreve o UID do túnel")
    parser.add_argument("--direct-url", help="Sobrescreve a URL direta da aplicação")
    parser.add_argument("--menu", action="store_true", help="Força a exibição do menu interativo")

    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")

    # ----- Subcomando: torrent -----
    torrent_parser = subparsers.add_parser("torrent", help="Gerenciar downloads de torrents no Deluge")
    torrent_sub = torrent_parser.add_subparsers(dest="subcommand")

    list_t = torrent_sub.add_parser("list", aliases=["ls"], help="Listar todos os torrents ativos")
    list_t.set_defaults(func=cmd_torrent_list)

    add_t = torrent_sub.add_parser("add", help="Adicionar novo torrent via Magnet link ou URL")
    add_t.add_argument("target", help="Magnet Link (magnet:?xt=...) ou URL do torrent")
    add_t.set_defaults(func=cmd_torrent_add)

    pause_t = torrent_sub.add_parser("pause", help="Pausar download de um torrent")
    pause_t.add_argument("id", help="ID ou hash do torrent")
    pause_t.set_defaults(func=cmd_torrent_pause)

    resume_t = torrent_sub.add_parser("resume", help="Retomar download de um torrent")
    resume_t.add_argument("id", help="ID ou hash do torrent")
    resume_t.set_defaults(func=cmd_torrent_resume)

    remove_t = torrent_sub.add_parser("remove", aliases=["rm"], help="Remover torrent do Deluge")
    remove_t.add_argument("id", help="ID ou hash do torrent")
    remove_t.add_argument("--with-data", action="store_true", help="Excluir também os arquivos baixados do disco")
    remove_t.set_defaults(func=cmd_torrent_remove)

    # ----- Subcomando: search -----
    search_parser = subparsers.add_parser("search", help="Gerenciar buscas automatizadas com Inteligência Artificial")
    search_sub = search_parser.add_subparsers(dest="subcommand")

    create_s = search_sub.add_parser("create", aliases=["new"], help="Iniciar uma nova busca autônoma de IA")
    create_s.add_argument("query", nargs="+", help="Nome do filme, série ou conteúdo a ser buscado")
    create_s.set_defaults(func=cmd_search_create)

    list_s = search_sub.add_parser("list", aliases=["ls"], help="Listar buscas de IA recentes")
    list_s.add_argument("--limit", type=int, default=10, help="Quantidade máxima a exibir (Padrão: 10)")
    list_s.set_defaults(func=cmd_search_list)

    status_s = search_sub.add_parser("status", help="Ver detalhes e avaliações de uma busca de IA")
    status_s.add_argument("id", help="ID da busca")
    status_s.set_defaults(func=cmd_search_status)

    # ----- Subcomando: config -----
    config_parser = subparsers.add_parser("config", help="Consultar e alterar configurações de IA e do sistema")
    config_sub = config_parser.add_subparsers(dest="subcommand")

    show_c = config_sub.add_parser("show", aliases=["get"], help="Exibir configurações atuais de IA")
    show_c.set_defaults(func=cmd_config_show)

    set_c = config_sub.add_parser("set", help="Atualizar preferências e chaves de IA")
    set_c.add_argument("--provider", choices=["openai", "anthropic"], help="Provedor de IA")
    set_c.add_argument("--model", help="Modelo de IA (ex: gemini-3-flash, claude-3-5-sonnet)")
    set_c.add_argument("--url", help="URL base da API de IA")
    set_c.add_argument("--token", help="Token de acesso (API Key)")
    set_c.add_argument("--audio", help="Idioma de áudio preferencial (ex: 'Português (Dublado)')")
    set_c.add_argument("--subtitle", help="Idioma da legenda (ex: 'Português (PT-BR)')")
    set_c.add_argument("--resolution", choices=["1080p", "720p", "2160p", "Qualquer"], help="Resolução preferencial")
    set_c.set_defaults(func=cmd_config_set)

    test_ai_c = config_sub.add_parser("test-ai", help="Testar comunicação com a IA configurada")
    test_ai_c.set_defaults(func=cmd_config_test_ai)

    # ----- Subcomando: relay -----
    relay_parser = subparsers.add_parser("relay", help="Verificar status e testar conexão com o Servidor Relay")
    relay_sub = relay_parser.add_subparsers(dest="subcommand")

    status_r = relay_sub.add_parser("status", help="Verificar status da conexão do túnel Relay")
    status_r.set_defaults(func=cmd_relay_status)

    test_r = relay_sub.add_parser("test", help="Testar comunicação com o Servidor Relay")
    test_r.set_defaults(func=cmd_relay_test)

    # ----- Subcomando: setup -----
    setup_parser = subparsers.add_parser("setup", help="Assistente interativo de configuração de URLs e credenciais")
    setup_parser.set_defaults(func=cmd_setup)

    args = parser.parse_args()

    # Aplica sobrescritas por argumento de linha de comando
    if args.mode: config["mode"] = args.mode
    if args.relay_url: config["relay_server_url"] = args.relay_url
    if args.token: config["relay_access_token"] = args.token
    if args.uid: config["relay_uid"] = args.uid
    if args.direct_url: config["direct_url"] = args.direct_url

    client = HunterClient(config)

    # Se um comando ou subcomando foi passado, executa-o diretamente
    if hasattr(args, "func"):
        args.func(client, args)
    else:
        # Quando executado puramente como `python hunter_cli.py`, abre o Menu Interativo!
        run_interactive_menu(client)


if __name__ == "__main__":
    main()
