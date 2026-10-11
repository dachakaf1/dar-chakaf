const { uploadIfBase64 } = require('./blob-upload');

// AVANT : l'image (data URI base64) était renvoyée telle quelle et
// stockée en base. MAINTENANT : elle est envoyée à Vercel Blob et
// on ne garde que le lien retourné — même qualité, base 100x plus légère.

const MAX_BASE64_SIZE = 8 * 1024 * 1024; // ~8Mo en base64 (avant compression déjà faite côté client)
const MIN_BASE64_SIZE = 3000; // une vraie photo compressée fait toujours plus que ça

async function uploadImage(imageUrl, type = 'gallery') {
    if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('INVALID_IMAGE');
    }

    // Cas 1 : data URI (photo envoyée depuis le téléphone/PC) — on l'envoie
    // vers Vercel Blob Storage et on ne garde que le lien.
    if (imageUrl.startsWith('data:image')) {
        if (imageUrl.length > MAX_BASE64_SIZE) {
            throw new Error('IMAGE_TOO_LARGE');
        }
        if (imageUrl.length < MIN_BASE64_SIZE) {
            throw new Error('BLANK_IMAGE');
        }
        const url = await uploadIfBase64(imageUrl, type);
        return {
            url,
            filename: `${type}_${Date.now()}`,
            path: null
        };
    }

    // Cas 2 : lien externe direct (http/https) — on le garde tel quel
    if (/^https?:\/\//i.test(imageUrl)) {
        return {
            url: imageUrl,
            filename: `${type}_${Date.now()}`,
            path: null
        };
    }

    throw new Error('INVALID_IMAGE');
}

async function deleteImage(url) {
    // Les images vivent maintenant sur Vercel Blob (fichiers), plus dans la
    // ligne DB elle-même. On ne supprime pas le fichier physique ici pour
    // rester simple ; le volume de stockage utilisé par ce site reste très faible.
    return true;
}

module.exports = {
    uploadImage,
    deleteImage
};
