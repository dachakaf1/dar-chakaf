const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const { uploadManyIfBase64 } = require('../lib/blob-upload');

async function get(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '12', 10), 50);
        const publishedOnly = req.query.published !== 'false';
        const where = publishedOnly ? 'WHERE published = TRUE' : '';
        const result = await db.query(
            `SELECT id, nom, ville, note, message, photos, published, created_at FROM avis_clients ${where} ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur get avis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        const { nom, ville, note, message, photos } = req.body;
        if (!nom || !message) return res.status(400).json({ success: false, message: 'Nom et message requis' });
        const safeNote = Math.max(1, Math.min(5, parseInt(note || 5, 10)));

        // Max 4 photos par avis, uploadées vers Vercel Blob si envoyées en base64
        let photoUrls = [];
        if (Array.isArray(photos) && photos.length > 0) {
            photoUrls = await uploadManyIfBase64(photos.slice(0, 4), 'avis');
        }

        const result = await db.query(
            'INSERT INTO avis_clients (nom, ville, note, message, photos, published) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *',
            [nom.trim(), ville || null, safeNote, message.trim(), JSON.stringify(photoUrls)]
        );
        return res.status(201).json({ success: true, message: 'Avis envoyé pour validation', data: result.rows[0] });
    } catch (error) {
        console.error('Erreur create avis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        const { published } = req.body;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });
        const result = await db.query('UPDATE avis_clients SET published = $1 WHERE id = $2 RETURNING *', [!!published, id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Avis non trouvé' });
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update avis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method === 'GET') return get(req, res);
    if (req.method === 'POST') return create(req, res);
    if (req.method === 'PUT') return update(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
