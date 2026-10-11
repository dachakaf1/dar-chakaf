// ============================================================
// AVANT : pour 5 photos, on faisait 5 INSERT séparés (un await
// par photo) = 5 aller-retours réseau vers Neon, l'un après
// l'autre. Sur une connexion qui vient de se réveiller (Neon
// "Idle"), chaque aller-retour ajoute de la latence.
//
// MAINTENANT : une seule requête INSERT avec plusieurs lignes
// de VALUES — un seul aller-retour, peu importe le nombre de
// photos.
// ============================================================

async function insertProductImages(db, produitId, urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;

    const values = [];
    const params = [];
    urls.forEach((url, idx) => {
        const base = idx * 3;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        params.push(produitId, url, idx);
    });

    await db.query(
        `INSERT INTO images (produit_id, url, ordre) VALUES ${values.join(', ')}`,
        params
    );
}

// Remplace toutes les images d'un produit (utilisé en update) :
// on supprime les anciennes puis on réinsère les nouvelles en une
// seule requête groupée.
async function replaceProductImages(db, produitId, urls) {
    await db.query('DELETE FROM images WHERE produit_id = $1', [produitId]);
    await insertProductImages(db, produitId, urls);
}

module.exports = { insertProductImages, replaceProductImages };
