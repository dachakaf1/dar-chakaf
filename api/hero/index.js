const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const { uploadImage } = require('../lib/image-handler');

let tableReady = false;

async function ensureTable() {
    if (tableReady) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS hero_images (
            id SERIAL PRIMARY KEY,
            url TEXT NOT NULL,
            ordre INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    tableReady = true;
}

// GET — publique : liste des images du diaporama, dans l'ordre d'affichage
async function getAll(req, res) {
    try {
        await ensureTable();
        const result = await db.query('SELECT * FROM hero_images ORDER BY ordre ASC, id ASC');
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur get hero images:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

// POST — admin : ajoute une image (URL directe ou photo convertie en base64)
async function create(req, res) {
    try {
        const user = requireAuth(req);
        await ensureTable();
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "URL de l'image requise" });

        const uploadResult = await uploadImage(url, 'hero');

        const maxOrdreResult = await db.query('SELECT COALESCE(MAX(ordre), -1) as m FROM hero_images');
        const ordre = maxOrdreResult.rows[0].m + 1;

        const result = await db.query(
            'INSERT INTO hero_images (url, ordre) VALUES ($1, $2) RETURNING *',
            [uploadResult.url, ordre]
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, "Ajout d'une image de fond (Accueil)"]
        );

        return res.status(201).json({ success: true, message: 'Image ajoutée avec succès', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        if (error.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ success: false, message: 'Image trop volumineuse (max ~5 Mo).' });
        if (error.message === 'INVALID_IMAGE') return res.status(400).json({ success: false, message: "Format d'image invalide. Utilisez un fichier image ou un lien https://..." });
        console.error('Erreur create hero image:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

// PUT — admin : réordonne le diaporama. Body attendu: { order: [id1, id2, id3, ...] }
async function reorder(req, res) {
    try {
        const user = requireAuth(req);
        await ensureTable();
        const { order } = req.body;
        if (!Array.isArray(order) || order.length === 0) {
            return res.status(400).json({ success: false, message: 'Liste ordre invalide' });
        }

        for (let i = 0; i < order.length; i++) {
            await db.query('UPDATE hero_images SET ordre = $1 WHERE id = $2', [i, order[i]]);
        }

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, "Réorganisation des images de fond (Accueil)"]
        );

        const result = await db.query('SELECT * FROM hero_images ORDER BY ordre ASC, id ASC');
        return res.status(200).json({ success: true, message: 'Ordre mis à jour', data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur reorder hero images:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

// DELETE — admin : supprime une image du diaporama
async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM hero_images WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Image non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, "Suppression d'une image de fond (Accueil)"]
        );

        return res.status(200).json({ success: true, message: 'Image supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete hero image:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return getAll(req, res);
    if (req.method === 'POST') return create(req, res);
    if (req.method === 'PUT') return reorder(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
