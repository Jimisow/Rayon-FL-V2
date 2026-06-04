// ui.js - Gestion de l'interface utilisateur

// Émojis par catégorie et par produit
const categoryEmojis = {
    'Fruits': '🍎',
    'Légumes': '🥬',
    'Autres': '🌿'
};

const productEmojiMap = {
    'ananas': '🍍', 'avocat': '🥑', 'banane': '🍌', 'cerise': '🍒',
    'citron': '🍋', 'coco': '🥥', 'figue': '🫐', 'fraise': '🍓',
    'mandarine': '🍊', 'mangue': '🥭', 'melon': '🍈', 'orange': '🍊',
    'pasteque': '🍉', 'poire': '🍐', 'pomme': '🍏', 'raisin': '🍇',
    'abricot': '🍑', 'peche': '🍑', 'nectarine': '🍑', 'prune': '🟣',
    'ail': '🧄', 'aubergine': '🍆', 'brocoli': '🥦', 'carotte': '🥕',
    'champignon': '🍄', 'chou': '🥬', 'concombre': '🥒', 'courgette': '🥒',
    'haricot': '🫘', 'mais': '🌽', 'oignon': '🧅', 'piment': '🌶️',
    'poivron': '🌶️', 'salade': '🥗', 'tomate': '🍅', 'pomme de terre': '🥔',
    'patate': '🥔', 'gingembre': '🫚', 'curcuma': '🫚', 'basilic': '🌿',
    'menthe': '🌿', 'persil': '🌿', 'thym': '🌿', 'jus': '🧃'
};

export function getProductEmoji(nom, cat) {
    const lowerNom = nom.toLowerCase();
    for (const [key, emoji] of Object.entries(productEmojiMap)) {
        if (lowerNom.includes(key)) return emoji;
    }
    return categoryEmojis[cat] || '📦';
}

export function getCategoryClass(cat) {
    if (cat === 'Fruits') return 'fruits';
    if (cat === 'Légumes') return 'legumes';
    return 'autres';
}

// Créer une carte produit avec swipe
export function createProductCard(product, onEdit, onDelete, onClick) {
    const wrapper = document.createElement('div');
    wrapper.className = 'swipe-container';
    
    // Actions swipe
    const actions = document.createElement('div');
    actions.className = 'swipe-actions';
    actions.innerHTML = `
        <button class="swipe-action edit" data-action="edit">
            <span>✏️</span>Modifier
        </button>
        <button class="swipe-action delete" data-action="delete">
            <span>🗑️</span>Supprimer
        </button>
    `;
    
    // Carte produit
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.code = product.code;
    
    const catClass = getCategoryClass(product.cat);
    const emoji = getProductEmoji(product.nom, product.cat);
    
    card.innerHTML = `
        <div class="card-left">
            <div class="product-icon ${catClass}">${emoji}</div>
            <div class="product-info">
                <span class="product-name">${escapeHtml(product.nom)}</span>
                <span class="product-category ${catClass}">${escapeHtml(product.cat)}</span>
            </div>
        </div>
        <span class="card-arrow">›</span>
    `;
    
    // Événements swipe
    let startX = 0;
    let isDragging = false;
    
    card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = false;
    });
    
    card.addEventListener('touchmove', (e) => {
        const dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) > 10) {
            isDragging = true;
            if (dx < -30) e.preventDefault();
        }
    });
    
    card.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (dx < -50) {
            const currentlyOpen = document.querySelector('.product-card.swiped');
            if (currentlyOpen && currentlyOpen !== card) {
                currentlyOpen.classList.remove('swiped');
            }
            card.classList.add('swiped');
        } else if (dx > 20) {
            card.classList.remove('swiped');
        }
    });
    
    // Clic sur la carte
    card.addEventListener('click', (e) => {
        if (card.classList.contains('swiped')) {
            card.classList.remove('swiped');
            return;
        }
        if (onClick) onClick(product);
    });
    
    // Boutons d'action
    const editBtn = actions.querySelector('[data-action="edit"]');
    const deleteBtn = actions.querySelector('[data-action="delete"]');
    
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.remove('swiped');
        if (onEdit) onEdit(product);
    });
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.remove('swiped');
        if (onDelete) onDelete(product);
    });
    
    wrapper.appendChild(actions);
    wrapper.appendChild(card);
    
    return wrapper;
}

// Fermer tous les swipe ouverts
export function closeAllSwipes() {
    document.querySelectorAll('.product-card.swiped').forEach(card => {
        card.classList.remove('swiped');
    });
}

// Afficher un toast
let toastTimeout = null;
export function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('show');
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Helper escape HTML
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}