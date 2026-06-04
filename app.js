// app.js - Application principale
import { 
    db, 
    initDatabase, 
    getAllProducts, 
    addToBuffer, 
    getBuffer, 
    clearBuffer,
    onBufferChange
} from './storage.js';

import {
    getGithubConfig,
    saveGithubConfig,
    getFile,
    putFile,
    getNextSwVersion,
    applyBufferToProducts,
    formatProductsJson
} from './github.js';

import {
    startScanner,
    stopScanner,
    toggleTorch,
    scanFromFile,
    isScannerRunning
} from './scanner.js';

import {
    createProductCard,
    closeAllSwipes,
    showToast,
    escapeHtml
} from './ui.js';

// ===== ÉTAT GLOBAL =====
let state = {
    products: [],
    buffer: [],
    filteredProducts: [],
    searchTerm: '',
    currentFilter: '',
    sortOrder: 'asc' // asc ou desc
};

let currentEditProduct = null;
let currentDeleteProduct = null;
let currentScanner = null;
let modalContainer = null;

// ===== INITIALISATION =====
async function init() {
    console.log('🚀 Rayon Frais - Démarrage');
    modalContainer = document.getElementById('modalContainer');
    
    // Charger les produits
    await loadProducts();
    
    // Charger le buffer
    await refreshBuffer();
    
    // Écouter les changements du buffer
    onBufferChange(async (newBuffer) => {
        state.buffer = newBuffer;
        updateBufferBadge();
    });
    
    // Configurer l'interface
    setupEventListeners();
    setupFilters();
    
    // Enregistrer le Service Worker
    registerServiceWorker();
    
    // Gérer l'installation PWA
    setupPWA();
    
    showToast('✅ Application prête');
}

async function loadProducts() {
    try {
        const response = await fetch('./produits.json');
        const productsFromJson = await response.json();
        await initDatabase(productsFromJson);
        state.products = await getAllProducts();
        applyFiltersAndSort();
    } catch (error) {
        console.error('Erreur chargement produits:', error);
        showToast('❌ Erreur chargement des produits');
    }
}

async function refreshBuffer() {
    state.buffer = await getBuffer();
    updateBufferBadge();
}

function updateBufferBadge() {
    const badge = document.getElementById('bufferBadge');
    const fab = document.getElementById('bufferFab');
    const count = state.buffer.length;
    
    if (count > 0) {
        fab.style.display = 'flex';
        badge.textContent = count;
    } else {
        fab.style.display = 'none';
    }
}

function applyFiltersAndSort() {
    let filtered = [...state.products];
    
    // Filtre recherche
    if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
            p.nom.toLowerCase().includes(term) || 
            p.code.includes(term)
        );
    }
    
    // Filtre catégorie
    if (state.currentFilter) {
        filtered = filtered.filter(p => p.cat === state.currentFilter);
    }
    
    // Tri
    filtered.sort((a, b) => {
        const comparison = a.nom.localeCompare(b.nom, 'fr');
        return state.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    state.filteredProducts = filtered;
    renderProductList();
}

function renderProductList() {
    const container = document.getElementById('productList');
    const countEl = document.getElementById('productCount');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.filteredProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>Aucun produit trouvé</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0 produit';
        return;
    }
    
    if (countEl) {
        countEl.textContent = `${state.filteredProducts.length} produit${state.filteredProducts.length > 1 ? 's' : ''}`;
    }
    
    const fragment = document.createDocumentFragment();
    
    state.filteredProducts.forEach(product => {
        const card = createProductCard(
            product,
            (p) => openEditModal(p),
            (p) => openDeleteModal(p),
            (p) => openBarcodeModal(p)
        );
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

// ===== FILTRES =====
function setupFilters() {
    const filterContainer = document.getElementById('filterChips');
    const filters = [
        { cat: '', label: 'Tous', icon: '📋' },
        { cat: 'Fruits', label: 'Fruits', icon: '🍎' },
        { cat: 'Légumes', label: 'Légumes', icon: '🥬' },
        { cat: 'Autres', label: 'Autres', icon: '🌿' }
    ];
    
    filterContainer.innerHTML = filters.map(f => `
        <button class="filter-chip ${state.currentFilter === f.cat ? 'active' : ''}" 
                data-cat="${f.cat}">
            ${f.icon} ${f.label}
        </button>
    `).join('');
    
    filterContainer.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            state.currentFilter = cat;
            
            // Mettre à jour l'UI active
            filterContainer.querySelectorAll('.filter-chip').forEach(b => 
                b.classList.remove('active')
            );
            btn.classList.add('active');
            
            applyFiltersAndSort();
        });
    });
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Recherche
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value;
            clearSearch.style.display = state.searchTerm ? 'flex' : 'none';
            applyFiltersAndSort();
        });
    }
    
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            state.searchTerm = '';
            clearSearch.style.display = 'none';
            applyFiltersAndSort();
        });
    }
    
    // Bouton tri
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
            sortBtn.textContent = state.sortOrder === 'asc' ? '⇅' : '⇵';
            applyFiltersAndSort();
        });
    }
    
    // Menu
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => openMenuModal());
    }
    
    // Buffer FAB
    const bufferFab = document.getElementById('bufferFab');
    if (bufferFab) {
        bufferFab.addEventListener('click', () => openBufferModal());
    }
    
    // Scroll pour fermer les swipes
    document.addEventListener('scroll', () => closeAllSwipes());
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.swipe-container')) {
            closeAllSwipes();
        }
    });
    
    // Header compact au scroll
    setupHeaderScroll();
}

function setupHeaderScroll() {
    const headerTop = document.getElementById('headerTop');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 50 && currentScroll > lastScroll) {
            headerTop?.classList.add('hidden');
        } else if (currentScroll < 30) {
            headerTop?.classList.remove('hidden');
        }
        lastScroll = currentScroll;
    });
}

// ===== MODAL MENU =====
function openMenuModal() {
    closeAllSwipes();
    
    const config = getGithubConfig();
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">⚙️ Menu</p>
        
        <button class="btn-primary" id="menuAddBtn" style="margin-bottom: 12px;">
            ➕ Ajouter un produit
        </button>
        
        <button class="btn-primary btn-blue" id="menuSettingsBtn" style="margin-bottom: 12px; background: linear-gradient(135deg,#1565c0,#1976d2);">
            🔧 Paramètres GitHub
        </button>
        
        <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border);">
        
        <div style="font-size: 12px; color: var(--text-tertiary); text-align: center;">
            📦 ${config.token ? '✅ Connecté' : '❌ Non configuré'}
        </div>
    `);
    
    openModal(modal);
    
    document.getElementById('menuAddBtn').onclick = () => {
        closeCurrentModal();
        openScanModal();
    };
    
    document.getElementById('menuSettingsBtn').onclick = () => {
        closeCurrentModal();
        openSettingsModal();
    };
}

// ===== MODAL SCANNER =====
function openScanModal() {
    let currentTab = 'scan';
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">📷 Ajouter un produit</p>
        
        <div class="tabs">
            <button class="tab-btn active" data-tab="scan">📷 Scanner</button>
            <button class="tab-btn" data-tab="manual">⌨️ Manuel</button>
        </div>
        
        <div id="scanTabContent">
            <div id="qr-reader" style="width: 100%;"></div>
            <div class="scanner-controls">
                <button id="torchBtn" class="torch-btn">🔦 Torche</button>
                <button id="galleryBtn" class="gallery-btn">📷 Photo</button>
            </div>
            <p class="scan-hint">Scannez le code-barres du produit</p>
        </div>
        
        <div id="manualTabContent" style="display: none;">
            <div class="form-group">
                <label>Code produit</label>
                <input type="text" id="manualCode" placeholder="Ex: 3283440020129">
            </div>
            <div class="form-group">
                <label>Nom du produit</label>
                <input type="text" id="manualNom" placeholder="Ex: Avocat">
            </div>
            <div class="form-group">
                <label>Catégorie</label>
                <select id="manualCat">
                    <option value="Fruits">🍎 Fruits</option>
                    <option value="Légumes">🥬 Légumes</option>
                    <option value="Autres">🌿 Autres</option>
                </select>
            </div>
            <button class="btn-primary" id="manualAddBtn">✅ Ajouter au buffer</button>
        </div>
    `);
    
    openModal(modal);
    
    // Gestion des onglets
    const scanTab = modal.querySelector('#scanTabContent');
    const manualTab = modal.querySelector('#manualTabContent');
    const tabBtns = modal.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (currentTab === 'scan') {
                scanTab.style.display = 'block';
                manualTab.style.display = 'none';
                startScannerInModal();
            } else {
                scanTab.style.display = 'none';
                manualTab.style.display = 'block';
                stopScannerInModal();
            }
        });
    });
    
    // Scanner
    let scannerStarted = false;
    
    async function startScannerInModal() {
        if (scannerStarted) return;
        const success = await startScanner('qr-reader', async (code) => {
            await stopScannerInModal();
            document.getElementById('manualCode').value = code;
            document.getElementById('manualNom').focus();
            // Basculer vers l'onglet manuel
            document.querySelector('.tab-btn[data-tab="manual"]').click();
        }, (err) => {
            console.warn('Scan error:', err);
        });
        scannerStarted = success;
    }
    
    async function stopScannerInModal() {
        if (scannerStarted) {
            await stopScanner();
            scannerStarted = false;
        }
    }
    
    // Torche
    const torchBtn = modal.querySelector('#torchBtn');
    if (torchBtn) {
        torchBtn.addEventListener('click', async () => {
            const state = await toggleTorch();
            torchBtn.textContent = state ? '🔦 ON' : '🔦 Torche';
        });
    }
    
    // Galerie
    const galleryBtn = modal.querySelector('#galleryBtn');
    if (galleryBtn) {
        galleryBtn.addEventListener('click', async () => {
            try {
                const code = await scanFromFile();
                if (code) {
                    document.getElementById('manualCode').value = code;
                    document.getElementById('manualNom').focus();
                    document.querySelector('.tab-btn[data-tab="manual"]').click();
                }
            } catch (err) {
                showToast('❌ Code non détecté');
            }
        });
    }
    
    // Ajout manuel
    const addBtn = modal.querySelector('#manualAddBtn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const code = document.getElementById('manualCode').value.trim();
            const nom = document.getElementById('manualNom').value.trim();
            const cat = document.getElementById('manualCat').value;
            
            if (!code || !nom) {
                showToast('⚠️ Code et nom requis');
                return;
            }
            
            // Vérifier doublon
            const existing = state.products.find(p => p.code === code);
            if (existing) {
                showToast(`⚠️ "${existing.nom}" existe déjà avec ce code`);
                return;
            }
            
            await addToBuffer({
                type: 'add',
                data: { code, nom, cat }
            });
            
            await refreshBuffer();
            closeCurrentModal();
            showToast(`✅ "${nom}" ajouté au buffer`);
        });
    }
    
    // Démarrer le scanner automatiquement
    setTimeout(() => {
        if (currentTab === 'scan') startScannerInModal();
    }, 100);
}

// ===== MODAL ÉDITION =====
function openEditModal(product) {
    currentEditProduct = product;
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">✏️ Modifier</p>
        
        <div class="form-group">
            <label>Code</label>
            <input type="text" id="editCode" value="${escapeHtml(product.code)}">
        </div>
        <div class="form-group">
            <label>Nom</label>
            <input type="text" id="editNom" value="${escapeHtml(product.nom)}">
        </div>
        <div class="form-group">
            <label>Catégorie</label>
            <select id="editCat">
                <option value="Fruits" ${product.cat === 'Fruits' ? 'selected' : ''}>🍎 Fruits</option>
                <option value="Légumes" ${product.cat === 'Légumes' ? 'selected' : ''}>🥬 Légumes</option>
                <option value="Autres" ${product.cat === 'Autres' ? 'selected' : ''}>🌿 Autres</option>
            </select>
        </div>
        
        <button class="btn-primary" id="saveEditBtn">💾 Enregistrer</button>
    `);
    
    openModal(modal);
    
    document.getElementById('saveEditBtn').onclick = async () => {
        const code = document.getElementById('editCode').value.trim();
        const nom = document.getElementById('editNom').value.trim();
        const cat = document.getElementById('editCat').value;
        
        if (!code || !nom) {
            showToast('⚠️ Code et nom requis');
            return;
        }
        
        await addToBuffer({
            type: 'edit',
            originalCode: currentEditProduct.code,
            data: { code, nom, cat }
        });
        
        await refreshBuffer();
        closeCurrentModal();
        showToast(`✏️ Modification enregistrée`);
    };
}

// ===== MODAL SUPPRESSION =====
function openDeleteModal(product) {
    currentDeleteProduct = product;
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title" style="text-align: center;">🗑️ Supprimer</p>
        <p style="text-align: center; font-size: 16px; font-weight: 600; margin: 8px 0;">
            ${escapeHtml(product.nom)}
        </p>
        <p style="text-align: center; font-size: 13px; color: var(--text-tertiary); margin-bottom: 20px;">
            La suppression sera appliquée lors de la publication
        </p>
        <div class="btn-row">
            <button class="btn-secondary" id="cancelDeleteBtn">Annuler</button>
            <button class="btn-danger" id="confirmDeleteBtn">Supprimer</button>
        </div>
    `);
    
    openModal(modal);
    
    document.getElementById('cancelDeleteBtn').onclick = () => closeCurrentModal();
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        await addToBuffer({
            type: 'delete',
            code: currentDeleteProduct.code
        });
        
        await refreshBuffer();
        closeCurrentModal();
        showToast(`🗑️ Suppression enregistrée`);
    };
}

// ===== MODAL CODE-BARRES =====
function openBarcodeModal(product) {
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title" style="text-align: center;">${escapeHtml(product.nom)}</p>
        <div style="text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 8px 0;">
            ${product.code}
        </div>
        <svg id="barcode-svg" style="display: block; margin: 0 auto; max-width: 100%;"></svg>
        <button class="btn-secondary" id="copyCodeBtn" style="margin-top: 16px;">📋 Copier le code</button>
    `);
    
    openModal(modal);
    
    // Générer le code-barres
    JsBarcode('#barcode-svg', product.code, {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 80,
        displayValue: false
    });
    
    document.getElementById('copyCodeBtn').onclick = () => {
        navigator.clipboard.writeText(product.code);
        showToast('✅ Code copié');
    };
}

// ===== MODAL BUFFER =====
async function openBufferModal() {
    const buffer = await getBuffer();
    
    const adds = buffer.filter(b => b.type === 'add');
    const edits = buffer.filter(b => b.type === 'edit');
    const dels = buffer.filter(b => b.type === 'delete');
    
    let preview = '';
    if (adds.length) preview += `── AJOUTS (${adds.length}) ──\n${adds.map(a => `+ ${a.data.nom} | ${a.data.code} | ${a.data.cat}`).join('\n')}\n\n`;
    if (edits.length) preview += `── MODIFICATIONS (${edits.length}) ──\n${edits.map(e => `~ ${e.originalCode} → ${e.data.nom}`).join('\n')}\n\n`;
    if (dels.length) preview += `── SUPPRESSIONS (${dels.length}) ──\n${dels.map(d => `- ${d.code}`).join('\n')}\n`;
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">📋 Buffer (${buffer.length})</p>
        <pre class="buffer-preview">${preview || 'Aucune modification'}</pre>
        <div class="btn-row">
            <button class="btn-secondary" id="copyBufferBtn">📋 Copier</button>
            <button class="btn-secondary" id="clearBufferBtn">🗑️ Effacer</button>
        </div>
        <button class="btn-primary" id="publishBufferBtn" style="margin-top: 12px;">🚀 Publier sur GitHub</button>
    `);
    
    openModal(modal);
    
    document.getElementById('copyBufferBtn').onclick = () => {
        navigator.clipboard.writeText(preview);
        showToast('✅ Buffer copié');
    };
    
    document.getElementById('clearBufferBtn').onclick = async () => {
        if (confirm('Effacer toutes les modifications ?')) {
            await clearBuffer();
            await refreshBuffer();
            closeCurrentModal();
            showToast('🗑️ Buffer effacé');
        }
    };
    
    document.getElementById('publishBufferBtn').onclick = () => {
        closeCurrentModal();
        openPublishConfirmModal();
    };
}

// ===== MODAL PUBLICATION =====
async function openPublishConfirmModal() {
    const config = getGithubConfig();
    if (!config.token || !config.owner || !config.repo) {
        showToast('⚙️ Configurez d\'abord GitHub dans les paramètres');
        openSettingsModal();
        return;
    }
    
    const buffer = await getBuffer();
    if (buffer.length === 0) {
        showToast('Aucune modification à publier');
        return;
    }
    
    const adds = buffer.filter(b => b.type === 'add');
    const edits = buffer.filter(b => b.type === 'edit');
    const dels = buffer.filter(b => b.type === 'delete');
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">🚀 Confirmation</p>
        
        <div style="margin-bottom: 16px;">
            ${adds.length ? `<div style="background: var(--g50); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
                <strong>➕ ${adds.length} ajout(s)</strong>
            </div>` : ''}
            ${edits.length ? `<div style="background: #e3f2fd; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
                <strong>✏️ ${edits.length} modification(s)</strong>
            </div>` : ''}
            ${dels.length ? `<div style="background: #ffebee; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
                <strong>🗑️ ${dels.length} suppression(s)</strong>
            </div>` : ''}
        </div>
        
        <div class="btn-row">
            <button class="btn-secondary" id="cancelPublishBtn">Annuler</button>
            <button class="btn-primary" id="confirmPublishBtn">Confirmer</button>
        </div>
    `);
    
    openModal(modal);
    
    document.getElementById('cancelPublishBtn').onclick = () => closeCurrentModal();
    document.getElementById('confirmPublishBtn').onclick = async () => {
        closeCurrentModal();
        await publishToGitHub();
    };
}

async function publishToGitHub() {
    showToast('⏳ Publication en cours...');
    
    try {
        const buffer = await getBuffer();
        
        // Récupérer produits.json actuel
        const prodFile = await getFile('produits.json');
        if (!prodFile) throw new Error('produits.json introuvable sur GitHub');
        
        let products = JSON.parse(fromBase64(prodFile.content));
        
        // Appliquer les modifications
        const adds = buffer.filter(b => b.type === 'add');
        const edits = buffer.filter(b => b.type === 'edit');
        const dels = buffer.filter(b => b.type === 'delete');
        
        // Suppressions
        dels.forEach(d => {
            products = products.filter(p => p.code !== d.code);
        });
        
        // Modifications
        edits.forEach(e => {
            const index = products.findIndex(p => p.code === e.originalCode);
            if (index !== -1) products[index] = e.data;
        });
        
        // Ajouts (sans doublons)
        const existingCodes = new Set(products.map(p => p.code));
        adds.forEach(a => {
            if (!existingCodes.has(a.data.code)) {
                products.push(a.data);
                existingCodes.add(a.data.code);
            }
        });
        
        // Sauvegarder produits.json
        const newProductsJson = formatProductsJson(products);
        await putFile('produits.json', `Mise à jour: +${adds.length} ✏️${edits.length} 🗑️${dels.length}`, newProductsJson, prodFile.sha);
        
        // Mettre à jour SW
        const swFile = await getFile('sw.js');
        if (swFile) {
            const swContent = fromBase64(swFile.content);
            const newVersion = getNextSwVersion(swContent);
            const newSwContent = swContent.replace(/rayon-frais-v\d+/, newVersion);
            await putFile('sw.js', `Bump cache ${newVersion}`, newSwContent, swFile.sha);
        }
        
        // Recharger les produits
        state.products = products;
        await db.products.clear();
        await db.products.bulkAdd(products);
        
        // Vider le buffer
        await clearBuffer();
        await refreshBuffer();
        
        // Rafraîchir l'affichage
        applyFiltersAndSort();
        
        showToast(`✅ Publié ! ${adds.length} ajout, ${edits.length} modif, ${dels.length} suppr`);
        
        // Proposer de rafraîchir la page
        setTimeout(() => {
            if (confirm('La nouvelle version est publiée. Rafraîchir la page ?')) {
                window.location.reload();
            }
        }, 1500);
        
    } catch (error) {
        console.error('Publication error:', error);
        showToast(`❌ Erreur: ${error.message}`);
    }
}

// ===== MODAL PARAMÈTRES =====
function openSettingsModal() {
    const config = getGithubConfig();
    
    const modal = createModal(`
        <div class="modal-handle"></div>
        <span class="modal-close" onclick="closeCurrentModal()">✕</span>
        <p class="modal-title">⚙️ Paramètres GitHub</p>
        
        <div class="settings-info" style="background: #fffde7; padding: 12px; border-radius: 10px; margin-bottom: 16px; font-size: 13px;">
            🔑 Token stocké localement. <br>
            Créer un token sur <a href="https://github.com/settings/tokens/new" target="_blank" style="color: var(--g800);">GitHub → Settings → Tokens</a><br>
            Cochez <strong>repo</strong>.
        </div>
        
        <div class="form-group">
            <label>Token GitHub</label>
            <input type="password" id="settingsToken" placeholder="ghp_xxxxxxxxxxxx" value="${config.token}">
        </div>
        <div class="form-group">
            <label>Propriétaire</label>
            <input type="text" id="settingsOwner" placeholder="votre-pseudo" value="${config.owner}">
        </div>
        <div class="form-group">
            <label>Repository</label>
            <input type="text" id="settingsRepo" placeholder="rayon-frais" value="${config.repo}">
        </div>
        <div class="form-group">
            <label>Branche</label>
            <input type="text" id="settingsBranch" placeholder="main" value="${config.branch}">
        </div>
        
        <button class="btn-primary" id="saveSettingsBtn">💾 Enregistrer</button>
    `);
    
    openModal(modal);
    
    document.getElementById('saveSettingsBtn').onclick = () => {
        saveGithubConfig({
            token: document.getElementById('settingsToken').value.trim(),
            owner: document.getElementById('settingsOwner').value.trim(),
            repo: document.getElementById('settingsRepo').value.trim(),
            branch: document.getElementById('settingsBranch').value.trim() || 'main'
        });
        closeCurrentModal();
        showToast('✅ Paramètres enregistrés');
    };
}

// ===== HELPER MODALS =====
function createModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-content">${content}</div>`;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCurrentModal();
    });
    return overlay;
}

function openModal(modal) {
    closeAllModals();
    modalContainer.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeCurrentModal() {
    const modal = modalContainer.querySelector('.modal-overlay');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    stopScannerInModalIfNeeded();
}

function closeAllModals() {
    modalContainer.innerHTML = '';
    document.body.style.overflow = '';
}

async function stopScannerInModalIfNeeded() {
    await stopScanner();
}

// Exposer globalement pour les onclick HTML
window.closeCurrentModal = closeCurrentModal;

// ===== SERVICE WORKER =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('SW enregistré');
                reg.update();
                
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('🔄 Nouvelle version disponible');
                        }
                    });
                });
            })
            .catch(err => console.error('SW error:', err));
        
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }
}

// ===== PWA INSTALLATION =====
function setupPWA() {
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'block';
    });
    
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            }
        });
    }
    
    // iOS banner
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone;
    const iosBanner = document.getElementById('iosBanner');
    
    if (isIos && !isStandalone && iosBanner) {
        iosBanner.style.display = 'block';
    }
}

// ===== DÉMARRAGE =====
init();

// Helper fromBase64 (doit être accessible)
function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}