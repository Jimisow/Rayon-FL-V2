// github.js - Communication avec l'API GitHub

const STORAGE_KEYS = {
    TOKEN: 'gh_token',
    OWNER: 'gh_owner',
    REPO: 'gh_repo',
    BRANCH: 'gh_branch'
};

// Sauvegarde/chargement des paramètres
export function getGithubConfig() {
    return {
        token: localStorage.getItem(STORAGE_KEYS.TOKEN) || '',
        owner: localStorage.getItem(STORAGE_KEYS.OWNER) || '',
        repo: localStorage.getItem(STORAGE_KEYS.REPO) || '',
        branch: localStorage.getItem(STORAGE_KEYS.BRANCH) || 'main'
    };
}

export function saveGithubConfig(config) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, config.token);
    localStorage.setItem(STORAGE_KEYS.OWNER, config.owner);
    localStorage.setItem(STORAGE_KEYS.REPO, config.repo);
    localStorage.setItem(STORAGE_KEYS.BRANCH, config.branch || 'main');
}

// Helpers base64
function toBase64(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

// Récupérer un fichier depuis GitHub
export async function getFile(path) {
    const config = getGithubConfig();
    if (!config.token || !config.owner || !config.repo) {
        throw new Error('Configuration GitHub manquante');
    }
    
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github+json'
        }
    });
    
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GitHub: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
}

// Mettre à jour un fichier sur GitHub
export async function putFile(path, message, content, sha = null) {
    const config = getGithubConfig();
    if (!config.token || !config.owner || !config.repo) {
        throw new Error('Configuration GitHub manquante');
    }
    
    const body = {
        message,
        content: toBase64(content),
        branch: config.branch
    };
    if (sha) body.sha = sha;
    
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Erreur ${response.status}`);
    }
    
    return response.json();
}

// Générer la version du SW
export function getNextSwVersion(currentContent) {
    const match = currentContent.match(/rayon-frais-v(\d+)/);
    if (match) {
        return `rayon-frais-v${parseInt(match[1]) + 1}`;
    }
    return 'rayon-frais-v1';
}

// Appliquer les modifications buffer sur les produits
export function applyBufferToProducts(products, buffer) {
    let result = [...products];
    const existingCodes = new Set(result.map(p => p.code));
    
    // Appliquer les suppressions (en premier)
    buffer.filter(item => item.type === 'delete').forEach(item => {
        result = result.filter(p => p.code !== item.code);
    });
    
    // Appliquer les modifications
    buffer.filter(item => item.type === 'edit').forEach(item => {
        const index = result.findIndex(p => p.code === item.originalCode);
        if (index !== -1) {
            result[index] = { ...item.data };
        }
    });
    
    // Ajouter les nouveaux (éviter doublons)
    buffer.filter(item => item.type === 'add').forEach(item => {
        if (!existingCodes.has(item.data.code)) {
            result.push(item.data);
            existingCodes.add(item.data.code);
        }
    });
    
    return result;
}

// Formater les produits en JSON
export function formatProductsJson(products) {
    const sorted = [...products].sort((a, b) => a.nom.localeCompare(b.nom));
    const lines = sorted.map((p, i) => {
        const comma = i < sorted.length - 1 ? ',' : '';
        return `  { "nom": "${escapeJson(p.nom)}", "code": "${p.code}", "cat": "${p.cat}" }${comma}`;
    });
    return '[\n' + lines.join('\n') + '\n]';
}

function escapeJson(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}