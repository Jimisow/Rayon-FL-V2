// storage.js - Gestion de la persistance
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs';

// Initialisation de la base de données
export const db = new Dexie('RayonFraisDB');
db.version(1).stores({
    products: 'code, nom, cat',
    buffer: '++id, type, code, timestamp'
});

// État de modification (cache rapide)
let modificationsCache = [];

// Charger les produits depuis produits.json et initialiser la DB
export async function initDatabase(initialProducts) {
    const count = await db.products.count();
    if (count === 0 && initialProducts?.length) {
        await db.products.bulkAdd(initialProducts);
    }
    return db.products.toArray();
}

// Récupérer tous les produits
export async function getAllProducts() {
    return db.products.toArray();
}

// Mettre à jour un produit
export async function updateProduct(product) {
    return db.products.put(product);
}

// Ajouter un produit
export async function addProduct(product) {
    return db.products.add(product);
}

// Supprimer un produit
export async function deleteProduct(code) {
    return db.products.delete(code);
}

// ===== GESTION DU BUFFER =====
export async function addToBuffer(action) {
    const bufferItem = {
        ...action,
        timestamp: Date.now(),
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random()
    };
    await db.buffer.add(bufferItem);
    await refreshModificationsCache();
    return bufferItem;
}

export async function getBuffer() {
    await refreshModificationsCache();
    return modificationsCache;
}

export async function removeFromBuffer(id) {
    await db.buffer.delete(id);
    await refreshModificationsCache();
}

export async function clearBuffer() {
    await db.buffer.clear();
    modificationsCache = [];
}

export async function getBufferCount() {
    if (modificationsCache.length === 0) await refreshModificationsCache();
    return modificationsCache.length;
}

async function refreshModificationsCache() {
    modificationsCache = await db.buffer.orderBy('timestamp').toArray();
}

// Export pour les listeners
export function onBufferChange(callback) {
    // On pourrait implémenter un observer, mais pour simplifier on fait un polling léger
    let lastCount = 0;
    setInterval(async () => {
        const current = await getBufferCount();
        if (current !== lastCount) {
            lastCount = current;
            callback(await getBuffer());
        }
    }, 500);
}