const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;

async function processPaths() {
    const { paths, maxDepth } = workerData;
    const results = [];
    
    console.log(`[Worker] Iniciando thread com ${paths.length} diretórios principais.`);
    
    for (const p of paths) {
        console.log(`[Worker] Processando: ${p}`);
        const tree = await buildTree(p, maxDepth, 1);
        if (tree) {
            results.push(tree);
        }
    }
    
    console.log(`[Worker] Thread finalizou o processamento.`);
    parentPort.postMessage({ results });
}

async function buildTree(dir, maxDepth, currentDepth = 0) {
    let stats;
    try {
        stats = await fsp.lstat(dir);
    } catch (e) {
        // Silenciamos apenas ENOENT (arquivo sumiu enquanto liamos). 
        // Qualquer outro erro grave deve ser logado para debug
        if (e.code !== 'ENOENT') {
             console.error(`[Worker] Erro ao ler stats de ${dir}: ${e.message}`);
        }
        return null;
    }

    let result = { name: path.basename(dir), path: dir, value: 0 };
    
    if (stats.isDirectory()) {
        result.children = [];
        if (currentDepth < maxDepth) {
            let files;
            try {
                files = await fsp.readdir(dir);
            } catch (e) {
                console.error(`[Worker] Erro de permissão/leitura na pasta ${dir}: ${e.message}`);
                files = [];
            }
            
            // Loop sequencial. O uso de Promise.all com 10.000 arquivos
            // causa o erro silencioso "EMFILE" (muitos arquivos abertos de uma vez),
            // travando todo o NodeJS no nível do Sistema Operacional.
            for (let file of files) {
                const child = await buildTree(path.join(dir, file), maxDepth, currentDepth + 1);
                if (child && child.value > 0) {
                    result.children.push(child);
                    result.value += child.value;
                }
            }
        }
    } else {
        result.value = stats.size;
    }
    return result;
}

processPaths().catch(err => {
    console.error(`[Worker] Erro fatal na thread:`, err);
    parentPort.postMessage({ error: err.message });
});
