const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getAll(req, res) {
    try {
        requireAuth(req);
        const result = await db.query('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get-all newsletter:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function subscribe(req, res) {
    try {
        const { email } = req.body;
        if (!email || !EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: 'Adresse email invalide' });
        }

        const result = await db.query(
            `INSERT INTO newsletter_subscribers (email, statut, created_at)
             VALUES ($1, 'active', NOW())
             ON CONFLICT (email) DO UPDATE SET statut = 'active'
             RETURNING *`,
            [email.toLowerCase().trim()]
        );

        return res.status(201).json({ success: true, message: 'Inscription réussie', data: result.rows[0] });
    } catch (error) {
        console.error('Erreur subscribe newsletter:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function unsubscribe(req, res) {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

        const result = await db.query(
            "UPDATE newsletter_subscribers SET statut = 'unsubscribed' WHERE email = $1 RETURNING *",
            [email.toLowerCase().trim()]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Email non trouvé' });
        return res.status(200).json({ success: true, message: 'Désinscription réussie' });
    } catch (error) {
        console.error('Erreur unsubscribe newsletter:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Abonné non trouvé' });
        return res.status(200).json({ success: true, message: 'Abonné supprimé' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete newsletter:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return getAll(req, res);
    if (req.method === 'POST') return subscribe(req, res);
    if (req.method === 'PATCH') return unsubscribe(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
