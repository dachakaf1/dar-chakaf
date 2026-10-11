const { put } = require('@vercel/blob');

// ============================================================
// AVANT : les images (déjà compressées côté navigateur en JPEG,
// ~150-400 Ko) étaient converties en base64 et stockées TELLES
// QUELLES dans la colonne TEXT de Postgres. Résultat : chaque
// lecture (liste produits, page produit) et chaque écriture
// (ajout/modif) faisait transiter des méga-octets à travers
// Neon, ce qui ralentissait tout — surtout la saisie de données.
//
// MAINTENANT : on décode le base64 une seule fois, on l'envoie
// vers Vercel Blob Storage (fichiers statiques servis par un CDN),
// et on ne garde que le lien (quelques dizaines de caractères)
// dans la base de données. Même qualité d'image (on ne touche pas
// aux pixels, juste à l'endroit où le fichier est stocké), mais
// la base et les API redeviennent légères.
// ============================================================

function parseDataUri(dataUri) {
    const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUri);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

// Upload une image si c'est une data URI base64 (photo tout juste
// choisie/compressée côté client). Si c'est déjà un lien http(s)
// (image déjà en ligne, ou produit pas encore modifié), ou si c'est
// vide, on la laisse telle quelle — aucun upload inutile.
async function uploadIfBase64(dataUri, folder = 'produits') {
    if (!dataUri || typeof dataUri !== 'string') return dataUri;
    if (!dataUri.startsWith('data:image')) return dataUri;

    const parsed = parseDataUri(dataUri);
    if (!parsed) return dataUri; // format inattendu : on ne bloque pas la sauvegarde

    const ext = (parsed.contentType.split('/')[1] || 'jpg').replace('+xml', '');
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(filename, parsed.buffer, {
        access: 'public',
        contentType: parsed.contentType,
        addRandomSuffix: false
    });

    return blob.url;
}

// Upload toute une liste d'images EN PARALLÈLE (Promise.all) plutôt
// qu'une par une — important quand un produit a 5-10 photos de galerie.
async function uploadManyIfBase64(urls, folder = 'produits') {
    if (!Array.isArray(urls)) return [];
    return Promise.all(urls.map((u) => uploadIfBase64(u, folder)));
}

module.exports = { uploadIfBase64, uploadManyIfBase64 };
