/**
 * magnet_extractor.js
 * Módulo inteligente e multi-estratégia para extrair magnet links de qualquer site ou HTML.
 * Suporta:
 * 1. Links <a> diretos com magnet:?
 * 2. Atributos data-* (data-magnet, data-url, data-href, data-torrent, etc.)
 * 3. Magnets codificados em query params (ex: ?url=magnet%3A... ou ?link=...)
 * 4. Strings codificadas em Base64 contendo magnet:?xt=
 * 5. Handlers onclick contendo magnet:
 * 6. Scripts embutidos e variáveis JavaScript globais
 * 7. Tema Orion SOP (StarckFilmesBR, Comando, etc.) via AJAX (in-browser e HTTP fetch)
 * 8. Simulação de cliques em botões de download com interceptação de abas e clipboard
 */

const { URL, URLSearchParams } = require('url');

// Extrai o título do documento a partir do HTML
function extractPageTitle(html) {
  if (!html) return '';
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  let title = m[1].replace(/<[^>]+>/g, '').trim();
  title = title
    .replace(/\s*[-–—|]\s*(Comando|Starck|Torrent|Filmes|Download|HD|Grátis|Baixar|Dublado|Mega|1080p|720p|4K).*$/i, '')
    .trim();
  return title;
}

// Extrai nome amigável de um magnet link
function extractMagnetTitle(magnet, linkText = '', pageTitle = '') {
  if (linkText) {
    const cleanText = linkText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const isGeneric = /^(baixar|download|magnet|torrent|clique aqui|link direto|download torrent|magnet link|opcao \d+|opção \d+)$/i.test(cleanText);
    if (!isGeneric && cleanText.length > 2 && cleanText.length < 150) {
      return cleanText;
    }
  }

  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      const decodedDn = decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
      if (decodedDn.length > 2) return decodedDn;
    }
  } catch (e) {}

  if (pageTitle && pageTitle.trim().length > 2) {
    const cleanPage = pageTitle.trim();
    if (linkText && !linkText.toLowerCase().includes(cleanPage.toLowerCase())) {
      const cleanSub = linkText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (cleanSub && cleanSub.length <= 40) {
        return `${cleanPage} - ${cleanSub}`;
      }
    }
    return cleanPage;
  }

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
    // Tenta decodificar URL caso esteja encapsulado
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
    // Se ainda tiver %3A no protocolo, decodifica
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

  // 4. Captura qualquer outro magnet solto no texto/scripts
  const globalMagnetRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;
  while ((match = globalMagnetRegex.exec(decoded)) !== null) {
    register(match[0], '');
  }

  return resultsMap;
}

/**
 * Resolve downloads protegidos por AJAX (ex: Orion SOP Theme como StarckFilmesBR)
 * a partir de HTML estático quando não se usa Puppeteer.
 */
async function resolveAjaxMagnetsFromHtml(html, pageUrl) {
  const results = new Map();
  if (!html || typeof html !== 'string') return results;

  // Detecta se é tema Orion SOP
  const hasOrion = html.includes('data-o-post') || 
                   html.includes('o-link-abrir') || 
                   html.includes('o-link-copiar') || 
                   html.includes('orion_revelar_download') ||
                   html.includes('OrionDownloadsConfig');

  if (!hasOrion) return results;

  const postMatch = html.match(/data-o-post=["'](\d+)["']/i);
  const postId = postMatch ? postMatch[1] : null;
  if (!postId) return results;

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

  if (!ajaxUrl) return results;

  const pageTitle = extractPageTitle(html);

  // Procura todos os botões com atributos Orion
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
    } catch (err) {
      // Ignora e tenta o próximo item
    }
  }

  return results;
}

/**
 * Função completa para execução dentro de uma página Puppeteer (in-browser evaluate).
 * Realiza todas as estratégias possíveis diretamente no contexto do DOM vivo da página:
 * 1. âncoras com href magnet:
 * 2. atributos data-*
 * 3. Base64 em links/atributos
 * 4. Tema Orion SOP (StarckFilmesBR, etc.) disparando os fetch AJAX diretamente com a sessão/cookies reais do navegador
 * 5. Scripts e JSONs na página
 * 6. Simulação de clique nos botões de download capturando links revelados, clipboard e abas
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

      const cleanLinkText = (linkText || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
    const pageTitle = pageH1 || document.title.replace(/\s*[-–—|]\s*(Comando|Starck|Torrent|Filmes|Download|HD|Grátis|Baixar|Dublado|Mega).*$/i, '').trim();

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
          // Tenta decodificar base64 do param
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

    // 5. Scripts embutidos e variáveis JS (ex: __INITIAL_STATE__, dados de torrents em JSON)
    const scriptElements = Array.from(document.querySelectorAll('script:not([src])'));
    const magnetGlobalRegex = /magnet:\?xt=urn:[^\s"'<>]+/gi;
    for (const sc of scriptElements) {
      const code = sc.textContent || '';
      let m;
      while ((m = magnetGlobalRegex.exec(code)) !== null) {
        addMagnet(m[0], 'Script Magnet', '', pageTitle);
      }
    }

    // 6. Fallback interativo: se ainda não achou nada, clica em botões de download e monitora
    if (extractedMagnets.length === 0) {
      const clickCandidates = Array.from(document.querySelectorAll('button.o-link-abrir, button.o-link-copiar, .btn-download, a.btn-download, button[class*="download"], a[class*="download"]')).slice(0, 5);
      for (const btn of clickCandidates) {
        try {
          btn.click();
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {}
      }

      // Re-escaneia novos links ou inputs manuais que surgiram após o clique
      const lateLinks = Array.from(document.querySelectorAll('a[href^="magnet:"], input.o-link-manual, input[value^="magnet:"]'));
      for (const el of lateLinks) {
        const val = el.getAttribute('href') || el.value || '';
        addMagnet(val, el.innerText || 'Download', el.parentElement?.innerText?.substring(0, 150), pageTitle);
      }
    }

    return extractedMagnets;
  });
}

module.exports = {
  extractPageTitle,
  extractMagnetTitle,
  cleanMagnet,
  extractMagnetsFromHtml,
  resolveAjaxMagnetsFromHtml,
  extractMagnetsInPuppeteerPage
};
