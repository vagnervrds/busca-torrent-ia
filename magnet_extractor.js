/**
 * magnet_extractor.js
 * Módulo inteligente e multi-estratégia para extrair magnet links de qualquer site ou HTML.
 * Suporta:
 * 1. Links <a> diretos com magnet:?
 * 2. Atributos data-* (data-magnet, data-url, data-href, data-torrent, etc.)
 * 3. Magnets codificados em query params (ex: ?url=magnet%3A... ou ?link=...)
 * 4. Strings codificadas em Base64 contendo magnet:?xt=
 * 5. Handlers onclick contendo magnet:
 * 6. Scripts embutidos e variáveis JavaScript globais (ex: destino = "magnet:...")
 * 7. Tema Orion SOP (StarckFilmesBR, Comando, etc.) via AJAX (in-browser e HTTP fetch)
 * 8. Páginas intermediárias/protetores com contagem regressiva/timer (ex: AnimesTorrents links.php, encurtadores, etc.)
 * 9. Aceleração de temporizadores e simulação de cliques em botões de download com interceptação
 */

const { URL, URLSearchParams } = require('url');

// Extrai o título do documento a partir do HTML
function extractPageTitle(html) {
  if (!html) return '';
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  let title = m[1].replace(/<[^>]+>/g, '').trim();
  title = title
    .replace(/\s*[-–—|]\s*(Comando|Starck|Torrent|Filmes|Download|HD|Grátis|Baixar|Dublado|Mega|1080p|720p|4K|Animes|AnimesTorrents).*$/i, '')
    .trim();
  return title;
}

// Extrai nome amigável de um magnet link
function extractMagnetTitle(magnet, linkText = '', pageTitle = '') {
  const cleanLink = (linkText || '').replace(/<[^>]+>/g, '').replace(/Clique para baixar[→\s]*/gi, '').replace(/\s+/g, ' ').trim();

  // 1. Tenta extrair do parâmetro dn= do próprio magnet link
  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      const decodedDn = decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
      if (decodedDn.length > 2 && !/^(torrent|download|magnet|preparando link)/i.test(decodedDn)) {
        if (cleanLink && /^(ep\b|s\d+|episódio|temporada)/i.test(cleanLink)) {
          return `${cleanLink} - ${decodedDn}`;
        }
        return decodedDn;
      }
    }
  } catch (e) {}

  // 2. Se o link tiver texto descritivo e relevante (ex: episódio, resolução, áudio)
  const isGeneric = /^(baixar|download|magnet|torrent|clique aqui|link direto|download torrent|magnet link|opcao \d+|opção \d+|preparando link.*|acessar link.*)$/i.test(cleanLink);
  if (!isGeneric && cleanLink.length > 2 && cleanLink.length < 150) {
    if (pageTitle && !cleanLink.toLowerCase().includes(pageTitle.toLowerCase()) && pageTitle.length > 2) {
      return `${pageTitle} - ${cleanLink}`;
    }
    return cleanLink;
  }

  // 3. Fallback: PageTitle + subtexto
  if (pageTitle && pageTitle.trim().length > 2) {
    const cleanPage = pageTitle.trim();
    if (cleanLink && !cleanLink.toLowerCase().includes(cleanPage.toLowerCase()) && !isGeneric) {
      return `${cleanPage} - ${cleanLink}`;
    }
    return cleanPage;
  }

  // 4. Fallback BTIH
  try {
    const xtMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (xtMatch && xtMatch[1]) {
      return `Torrent (${xtMatch[1].substring(0, 10)})`;
    }
  } catch (e) {}

  return 'Torrent Sem Título';
}

// Limpa e normaliza um magnet link
function cleanMagnet(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let mag = raw.trim();
  if (!mag.toLowerCase().includes('magnet:?xt=urn:')) {
    try {
      const decoded = decodeURIComponent(mag);
      if (decoded.toLowerCase().includes('magnet:?xt=urn:')) {
        mag = decoded;
      }
    } catch (e) {}
  }
  const match = mag.match(/magnet:\?xt=urn:[^\s"'<>]+/i);
  if (!match) return null;
  let finalMag = match[0];
  try {
    if (finalMag.toLowerCase().startsWith('magnet%3a')) {
      finalMag = decodeURIComponent(finalMag);
    }
  } catch (e) {}
  return finalMag.trim();
}

/**
 * Extração estática síncrona a partir de string HTML ou texto.
 * Retorna Map<string, string> (magnet -> title).
 */
function extractMagnetsFromHtml(htmlOrText, pageUrl = '') {
  const resultsMap = new Map();
  if (!htmlOrText || typeof htmlOrText !== 'string') return resultsMap;

  const pageTitle = extractPageTitle(htmlOrText);
  let decoded = htmlOrText
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  decoded = decoded.replace(/magnet%3A%3F/gi, 'magnet:?');

  let optionCounter = 1;

  function register(mag, linkText) {
    const cleaned = cleanMagnet(mag);
    if (!cleaned || resultsMap.has(cleaned)) return;
    let title = extractMagnetTitle(cleaned, linkText, pageTitle);
    const existingTitles = Array.from(resultsMap.values());
    if (existingTitles.includes(title)) {
      title = `${title} (Opção ${optionCounter})`;
    }
    optionCounter++;
    resultsMap.set(cleaned, title);
  }

  // 1. Tags <a> contendo magnet links
  const aTagRegex = /<a\s+[^>]*href=["']?([^"' >]*magnet:\?xt=urn:[^"' >]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = aTagRegex.exec(decoded)) !== null) {
    register(match[1], match[2]);
  }

  // 2. Atributos data-* ou onclick com magnet
  const attrRegex = /(?:data-[a-z0-9_-]*|href|onclick)=["']([^"']*(?:magnet:\?xt=urn:|magnet%3A%3Fxt%3Durn%3A)[^"']*)["']/gi;
  while ((match = attrRegex.exec(decoded)) !== null) {
    register(match[1], '');
  }

  // 3. Magnets codificados em Base64 (bWFnbmV0Oj94dD...)
  const b64Regex = /(?:["'=])(bWFnbmV0Oj[a-zA-Z0-9+/=]+)(?:["'&])/g;
  while ((match = b64Regex.exec(decoded)) !== null) {
    try {
      const decodedStr = Buffer.from(match[1], 'base64').toString('utf-8');
      if (decodedStr.includes('magnet:?xt=urn:')) {
        register(decodedStr, '');
      }
    } catch (e) {}
  }

  // 4. Captura qualquer outro magnet solto no texto/scripts (ex: destino = "magnet:...")
  const globalMagnetRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;
  while ((match = globalMagnetRegex.exec(decoded)) !== null) {
    register(match[0], '');
  }

  return resultsMap;
}

/**
 * Encontra links para protetores ou páginas intermediárias de download
 * na página (ex: animestorrents.com/links.php?id=..., download.php, etc.)
 */
function findIntermediaryDownloadLinks(html, pageUrl) {
  const items = [];
  if (!html || typeof html !== 'string') return items;

  const seenUrls = new Set();
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  const ignoredPatterns = [
    /facebook\.com/i, /twitter\.com/i, /instagram\.com/i, /whatsapp\.com/i, /telegram\./i,
    /youtube\.com/i, /pinterest\.com/i, /\/category\//i, /\/tag\//i, /\/page\//i,
    /\/categoria\//i, /\/genero\//i, /\/autor\//i, /\/author\//i, /javascript:/i,
    /^#$/, /wp-login/i, /login/i, /contato/i, /sobre/i, /dmca/i, /termos/i, /politica/i
  ];

  while ((m = linkRegex.exec(html)) !== null) {
    const rawHref = m[1].trim();
    if (!rawHref || rawHref.startsWith('magnet:')) continue;

    let fullUrl = rawHref;
    if (pageUrl) {
      try {
        fullUrl = new URL(rawHref, pageUrl).href;
      } catch (e) {
        continue;
      }
    }

    if (seenUrls.has(fullUrl)) continue;

    const hrefLower = fullUrl.toLowerCase();
    if (ignoredPatterns.some(p => p.test(hrefLower))) continue;

    const rawText = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const cleanLabel = rawText.replace(/Clique para baixar[→\s]*/gi, '').trim();

    // Critérios para link intermediário de download:
    // 1. Padrões de URL conhecidos (links.php, link.php, download.php, /download/, protetor, token=, etc.)
    const isIntermediaryUrl = /links?\.php\?|download\.php\?|\/download\/|protetor|encurtador|token=|revelar|get_link/i.test(hrefLower);

    // 2. Texto indicando episódios, temporadas ou downloads específicos
    const hasDownloadText = /(?:ep(?:is[oó]dio)?\.?\s*\d+|s\d+\.?|temporada\s*\d+|baixar|download|multi-subs|dublado|legendado|\b(?:720p|1080p|2160p|4k)\b)/i.test(rawText);

    if (isIntermediaryUrl || hasDownloadText) {
      seenUrls.add(fullUrl);
      items.push({
        url: fullUrl,
        rawText,
        cleanLabel: cleanLabel || rawText || 'Download'
      });
    }
  }

  return items;
}

/**
 * Resolve páginas intermediárias via requisições HTTP paralelas.
 */
async function resolveIntermediaryLinksHttp(links, parentUrl, parentTitle, concurrency = 5) {
  const results = new Map();
  if (!links || links.length === 0) return results;

  // Limita a concorrência para ser rápido sem sobrecarregar o host
  for (let i = 0; i < links.length; i += concurrency) {
    const chunk = links.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (item) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch(item.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            ...(parentUrl ? { 'Referer': parentUrl } : {})
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const subHtml = await resp.text();
          const subMagnets = extractMagnetsFromHtml(subHtml, item.url);

          for (const [mag, titleFromSub] of subMagnets) {
            let compositeTitle = '';
            if (parentTitle && item.cleanLabel) {
              compositeTitle = `${parentTitle} - ${item.cleanLabel}`;
            } else if (item.cleanLabel) {
              compositeTitle = item.cleanLabel;
            } else {
              compositeTitle = titleFromSub;
            }
            results.set(mag, compositeTitle);
          }
        }
      } catch (err) {
        // Falha no fetch individual
      }
    }));
  }

  return results;
}

/**
 * Resolve downloads protegidos por AJAX (ex: Orion SOP Theme como StarckFilmesBR)
 * e também páginas intermediárias/protetores com temporizadores (ex: AnimesTorrents).
 */
async function resolveProtectedAndIntermediaryMagnets(html, pageUrl) {
  const results = new Map();
  if (!html || typeof html !== 'string') return results;

  const pageTitle = extractPageTitle(html);

  // 1. Verifica Tema Orion SOP (StarckFilmesBR, Comando, etc.)
  const hasOrion = html.includes('data-o-post') || 
                   html.includes('o-link-abrir') || 
                   html.includes('o-link-copiar') || 
                   html.includes('orion_revelar_download') ||
                   html.includes('OrionDownloadsConfig');

  if (hasOrion) {
    const postMatch = html.match(/data-o-post=["'](\d+)["']/i);
    const postId = postMatch ? postMatch[1] : null;

    let ajaxUrl = null;
    const ajaxMatch = html.match(/"ajaxUrl"\s*:\s*"([^"]+)"/i);
    if (ajaxMatch) {
      ajaxUrl = ajaxMatch[1].replace(/\\\//g, '/');
    } else if (pageUrl) {
      try {
        const u = new URL(pageUrl);
        ajaxUrl = `${u.origin}/wp-admin/admin-ajax.php`;
      } catch (e) {}
    }

    if (postId && ajaxUrl) {
      const btnRegex = /<button\b([^>]*data-o-(?:kind|group|index)[^>]*)>([\s\S]*?)<\/button>/gi;
      const buttonsToFetch = [];
      const seenKeys = new Set();

      let btnMatch;
      while ((btnMatch = btnRegex.exec(html)) !== null) {
        const attrs = btnMatch[1];
        const groupMatch = attrs.match(/data-o-group=["']([^"']+)["']/i);
        const indexMatch = attrs.match(/data-o-index=["']([^"']+)["']/i);
        const kindMatch = attrs.match(/data-o-kind=["']([^"']+)["']/i);

        const group = groupMatch ? groupMatch[1] : '';
        const index = indexMatch ? indexMatch[1] : '0';
        const kind = kindMatch ? kindMatch[1] : 'download';

        const key = `${postId}:${group}:${index}:${kind}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          buttonsToFetch.push({ postId, group, index, kind });
        }
      }

      for (const item of buttonsToFetch) {
        try {
          const params = new URLSearchParams({
            action: 'orion_revelar_download',
            post_id: item.postId,
            group: item.group,
            index: item.index,
            kind: item.kind
          });

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const resp = await fetch(ajaxUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              ...(pageUrl ? { 'Referer': pageUrl } : {})
            },
            body: params.toString(),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            if (data && data.success && data.data && data.data.url) {
              const cleaned = cleanMagnet(data.data.url);
              if (cleaned && !results.has(cleaned)) {
                const labelParts = [pageTitle, item.group.replace(/_/g, ' ').toUpperCase()].filter(Boolean);
                const title = extractMagnetTitle(cleaned, labelParts.join(' - '), pageTitle);
                results.set(cleaned, title);
              }
            }
          }
        } catch (err) {}
      }
    }
  }

  // 2. Se ainda não encontrou magnets, verifica links intermediários / protetores (ex: animestorrents.com)
  if (results.size === 0) {
    const intermediaryLinks = findIntermediaryDownloadLinks(html, pageUrl);
    if (intermediaryLinks.length > 0) {
      const resolvedMap = await resolveIntermediaryLinksHttp(intermediaryLinks, pageUrl, pageTitle);
      for (const [mag, title] of resolvedMap) {
        results.set(mag, title);
      }
    }
  }

  return results;
}

// Alias para manter compatibilidade com chamadas anteriores
const resolveAjaxMagnetsFromHtml = resolveProtectedAndIntermediaryMagnets;

/**
 * Função completa para execução dentro de uma página Puppeteer (in-browser evaluate).
 * Realiza todas as estratégias possíveis diretamente no contexto do DOM vivo da página:
 * 1. Âncoras com href magnet:
 * 2. Atributos data-* e onclick
 * 3. Base64 em links/atributos
 * 4. Tema Orion SOP via AJAX in-browser (sessão viva)
 * 5. Links intermediários/protetores (ex: AnimesTorrents) buscando sub-recursos
 * 6. Scripts e JSONs na página (ex: destino = "magnet:...")
 * 7. Simulação de clique nos botões de download capturando links revelados, clipboard e abas
 */
async function extractMagnetsInPuppeteerPage(page) {
  return await page.evaluate(async () => {
    const extractedMagnets = [];
    const seenHrefs = new Set();

    function addMagnet(rawHref, linkText = '', parentText = '', extraTitle = '') {
      if (!rawHref || typeof rawHref !== 'string') return;
      let href = rawHref.trim();

      if (!href.toLowerCase().includes('magnet:?xt=urn:')) {
        try {
          const dec = decodeURIComponent(href);
          if (dec.toLowerCase().includes('magnet:?xt=urn:')) href = dec;
        } catch (e) {}
      }

      const match = href.match(/magnet:\?xt=urn:[^\s"'<>]+/i);
      if (!match) return;
      href = match[0].trim();
      try {
        if (href.toLowerCase().startsWith('magnet%3a')) {
          href = decodeURIComponent(href);
        }
      } catch (e) {}

      if (seenHrefs.has(href)) return;
      seenHrefs.add(href);

      let displayName = extraTitle || '';
      try {
        const dnMatch = href.match(/[?&]dn=([^&]+)/i);
        if (dnMatch) {
          displayName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
        }
      } catch (e) {}

      const cleanLinkText = (linkText || '').replace(/<[^>]+>/g, '').replace(/Clique para baixar[→\s]*/gi, '').replace(/\s+/g, ' ').trim();
      const finalDisplayName = displayName || extraTitle || cleanLinkText || 'Torrent Magnet';

      extractedMagnets.push({
        index: extractedMagnets.length,
        linkText: cleanLinkText || finalDisplayName,
        parentText: (parentText || '').replace(/\s+/g, ' ').trim(),
        href,
        displayName: finalDisplayName
      });
    }

    const pageH1 = document.querySelector('h1')?.innerText?.trim() || '';
    const pageTitle = pageH1 || document.title.replace(/\s*[-–—|]\s*(Comando|Starck|Torrent|Filmes|Download|HD|Grátis|Baixar|Dublado|Mega|Animes|AnimesTorrents).*$/i, '').trim();

    // 1. Links <a> diretos com magnet:
    const directLinks = Array.from(document.querySelectorAll('a[href^="magnet:"], a[href*="magnet:?xt="], a[href*="magnet%3A%3F"]'));
    for (const a of directLinks) {
      addMagnet(
        a.getAttribute('href'),
        a.innerText.trim(),
        a.parentElement ? a.parentElement.innerText.substring(0, 150) : ''
      );
    }

    // 2. Atributos data-* e onclick
    const elementsWithData = Array.from(document.querySelectorAll('[data-magnet], [data-url*="magnet:"], [data-href*="magnet:"], [data-link*="magnet:"], [data-torrent*="magnet:"], [onclick*="magnet:"]'));
    for (const el of elementsWithData) {
      const val = el.dataset.magnet || el.dataset.url || el.dataset.href || el.dataset.link || el.dataset.torrent || el.getAttribute('onclick') || '';
      addMagnet(
        val,
        el.innerText.trim(),
        el.parentElement ? el.parentElement.innerText.substring(0, 150) : ''
      );
    }

    // 3. Links com Base64 ou redirecionamentos embutidos (?url= ou ?link=)
    const anyLinks = Array.from(document.querySelectorAll('a[href*="url="], a[href*="link="], a[href*="download"], a[data-b64]'));
    for (const a of anyLinks) {
      const rawHref = a.getAttribute('href') || '';
      try {
        const urlObj = new URL(rawHref, window.location.href);
        for (const [, pVal] of urlObj.searchParams) {
          if (pVal.includes('magnet:') || pVal.includes('magnet%3A')) {
            addMagnet(pVal, a.innerText.trim(), a.parentElement?.innerText?.substring(0, 150));
          }
          try {
            const b64Dec = atob(pVal);
            if (b64Dec.includes('magnet:?xt=urn:')) {
              addMagnet(b64Dec, a.innerText.trim(), a.parentElement?.innerText?.substring(0, 150));
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    // 4. Tema Orion SOP (StarckFilmesBR, Comando, etc.)
    const orionButtons = Array.from(document.querySelectorAll('button.o-link-abrir, button.o-link-copiar, [data-o-kind="download"], button[data-o-index]'));
    const ajaxUrl = (window.OrionDownloadsConfig && window.OrionDownloadsConfig.ajaxUrl) 
      || '/wp-admin/admin-ajax.php';

    const orionKeySet = new Set();
    const uniqueOrionButtons = [];
    for (const btn of orionButtons) {
      const panel = btn.closest('.o-dl') || document.querySelector('.o-dl');
      const postId = (panel && panel.dataset.oPost) || btn.dataset.oPost || (document.querySelector('[data-o-post]') && document.querySelector('[data-o-post]').dataset.oPost);
      const group = btn.dataset.oGroup || '';
      const idx = btn.dataset.oIndex || '0';
      const kind = btn.dataset.oKind || 'download';
      const key = `${postId}:${group}:${idx}:${kind}`;
      if (postId && !orionKeySet.has(key)) {
        orionKeySet.add(key);
        uniqueOrionButtons.push({ btn, postId, group, idx, kind });
      }
    }

    for (const item of uniqueOrionButtons) {
      try {
        const itemContainer = item.btn.closest('.o-arquivo, .o-link-item') || item.btn.parentElement;
        const qualityText = itemContainer ? (itemContainer.querySelector('.o-q')?.innerText.trim() || '') : '';
        const infoText = itemContainer ? (itemContainer.querySelector('.o-arquivo-info')?.innerText.replace(/\s+/g, ' ').trim() || '') : '';
        const groupHeader = itemContainer ? (itemContainer.closest('.o-lista')?.querySelector('.o-grupo-nome')?.innerText.trim() || item.group) : item.group;
        
        const labelParts = [pageTitle, qualityText, infoText, groupHeader].filter(Boolean);
        const compositeLabel = labelParts.join(' - ');

        const params = new URLSearchParams({
          action: 'orion_revelar_download',
          post_id: item.postId,
          group: item.group,
          index: item.idx,
          kind: item.kind
        });

        const resp = await fetch(ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: params.toString()
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success && data.data && data.data.url) {
            addMagnet(
              data.data.url,
              compositeLabel || item.btn.innerText.trim(),
              itemContainer ? itemContainer.innerText.substring(0, 150) : '',
              compositeLabel
            );
          }
        }
      } catch (err) {}
    }

    // 5. Links Intermediários e Protetores de Links (ex: AnimesTorrents / links.php?id=...)
    if (extractedMagnets.length === 0) {
      const intermediaryLinks = Array.from(document.querySelectorAll('a[href*="links.php"], a[href*="link.php"], a[href*="download.php"], a[href*="/download/"], a[href*="protetor"], a[href*="encurtador"]'));
      for (const a of intermediaryLinks) {
        try {
          const rawText = a.innerText.trim();
          const cleanLabel = rawText.replace(/Clique para baixar[→\s]*/gi, '').replace(/\s+/g, ' ').trim();
          const compositeTitle = pageTitle && cleanLabel ? `${pageTitle} - ${cleanLabel}` : (cleanLabel || pageTitle);

          const subResp = await fetch(a.href);
          if (subResp.ok) {
            const subText = await subResp.text();
            const subMagnets = subText.match(/magnet:\?xt=urn:[^\s"'<>]+/gi);
            if (subMagnets) {
              for (const m of subMagnets) {
                addMagnet(m, cleanLabel, a.parentElement?.innerText?.substring(0, 150), compositeTitle);
              }
            }
          }
        } catch (e) {}
      }
    }

    // 6. Scripts embutidos e variáveis JS (ex: destino = "magnet:...", __INITIAL_STATE__)
    const scriptElements = Array.from(document.querySelectorAll('script:not([src])'));
    const magnetGlobalRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;
    for (const sc of scriptElements) {
      const code = sc.textContent || '';
      let m;
      while ((m = magnetGlobalRegex.exec(code)) !== null) {
        addMagnet(m[0], 'Script Magnet', '', pageTitle);
      }
    }

    // 7. Fallback interativo: clica em botões de download e monitora novos links/inputs
    if (extractedMagnets.length === 0) {
      const clickCandidates = Array.from(document.querySelectorAll('#botao, button.o-link-abrir, button.o-link-copiar, .btn-download, a.btn-download, button[class*="download"], a[class*="download"]')).slice(0, 5);
      for (const btn of clickCandidates) {
        try {
          btn.click();
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {}
      }

      const lateLinks = Array.from(document.querySelectorAll('a[href^="magnet:"], #linkTexto, input.o-link-manual, input[value^="magnet:"]'));
      for (const el of lateLinks) {
        const val = el.getAttribute('href') || el.value || el.innerText || '';
        addMagnet(val, el.innerText || 'Download', el.parentElement?.innerText?.substring(0, 150), pageTitle);
      }
    }

    return extractedMagnets;
  });
}

/**
 * Função para acelerar e resolver páginas de protetores com temporizadores/contagem regressiva via Puppeteer
 * (ex: quando o link intermediário não expõe o magnet no HTML estático e precisa esperar 15s)
 */
async function resolveProtectorWithTimerInPuppeteer(browser, protectorUrl, parentTitle = '') {
  let subPage = null;
  try {
    subPage = await browser.newPage();
    await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

    // Injeta aceleração de temporizadores antes do script do site rodar
    // Transforma contagens de 15 segundos em ~450ms!
    await subPage.evaluateOnNewDocument(() => {
      const origSetInterval = window.setInterval;
      window.setInterval = function (fn, delay) {
        return origSetInterval(fn, Math.min(delay, 25));
      };
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (fn, delay) {
        return origSetTimeout(fn, Math.min(delay, 25));
      };
      // Se já existir variável de segundos
      try {
        Object.defineProperty(window, 'segundos', {
          set(v) {},
          get() { return 0; }
        });
      } catch (e) {}
    });

    await subPage.goto(protectorUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Aguarda ~1s para timer acelerado finalizar
    await new Promise(r => setTimeout(r, 1000));

    // Extrai o magnet link gerado após o timer
    const magnets = await extractMagnetsInPuppeteerPage(subPage);
    return magnets;
  } catch (err) {
    return [];
  } finally {
    if (subPage) {
      await subPage.close().catch(() => {});
    }
  }
}

module.exports = {
  extractPageTitle,
  extractMagnetTitle,
  cleanMagnet,
  extractMagnetsFromHtml,
  findIntermediaryDownloadLinks,
  resolveIntermediaryLinksHttp,
  resolveProtectedAndIntermediaryMagnets,
  resolveAjaxMagnetsFromHtml,
  extractMagnetsInPuppeteerPage,
  resolveProtectorWithTimerInPuppeteer
};
