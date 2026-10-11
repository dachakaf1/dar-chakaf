const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const { uploadImage } = require('../lib/image-handler');

async function list(req, res) {
    try {
        const result = await db.query('SELECT * FROM about_offers ORDER BY ordre ASC, id ASC');
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur list about_offers:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        const user = requireAuth(req);
        const { image, titre, description, countdown_end, ordre, actif } = req.body || {};
        if (!titre) return res.status(400).json({ success: false, message: 'Le titre est requis' });

        let imageUrl = null;
        if (image) {
            const uploaded = await uploadImage(image, 'offer');
            imageUrl = uploaded.url;
        }

        const result = await db.query(
            'INSERT INTO about_offers (image, titre, description, countdown_end, ordre, actif) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [imageUrl, titre, description || null, countdown_end || null, Number.isFinite(ordre) ? ordre : 0, actif !== false]
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Ajout de l'offre "${titre}" (page À propos)`]
        );

        return res.status(201).json({ success: true, message: 'Offre ajoutée', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        if (error.message === 'INVALID_IMAGE') return res.status(400).json({ success: false, message: 'Image invalide' });
        if (error.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ success: false, message: 'Image trop lourde' });
        if (error.message === 'BLANK_IMAGE') return res.status(400).json({ success: false, message: 'Image vide' });
        console.error('Erreur create about_offer:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const { image, titre, description, countdown_end, ordre, actif } = req.body || {};

        let imageUrl = image || null;
        if (image && image.startsWith('data:image')) {
            const uploaded = await uploadImage(image, 'offer');
            imageUrl = uploaded.url;
        }

        const result = await db.query(
            'UPDATE about_offers SET image = $1, titre = $2, description = $3, countdown_end = $4, ordre = $5, actif = $6 WHERE id = $7 RETURNING *',
            [imageUrl, titre, description || null, countdown_end || null, Number.isFinite(ordre) ? ordre : 0, actif !== false, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Offre non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Modification de l'offre ID ${id} (page À propos)`]
        );

        return res.status(200).json({ success: true, message: 'Offre mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        if (error.message === 'INVALID_IMAGE') return res.status(400).json({ success: false, message: 'Image invalide' });
        if (error.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ success: false, message: 'Image trop lourde' });
        if (error.message === 'BLANK_IMAGE') return res.status(400).json({ success: false, message: 'Image vide' });
        console.error('Erreur update about_offer:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM about_offers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Offre non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression de l'offre ID ${id} (page À propos)`]
        );

        return res.status(200).json({ success: true, message: 'Offre supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete about_offer:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return list(req, res);
    if (req.method === 'POST') return create(req, res);
    if (req.method === 'PUT') return update(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
