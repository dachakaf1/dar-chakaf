const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

async function getAll(req, res) {
    try {
        requireAuth(req);
        const { lu, limit = 50 } = req.query;
        let query = 'SELECT * FROM messages';
        const params = [];
        if (lu !== undefined) {
            query += ' WHERE lu = $1';
            params.push(lu === 'true');
        }
        query += ' ORDER BY date DESC LIMIT $' + (params.length + 1);
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get-all messages:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function send(req, res) {
    try {
        const { nom, telephone, email, sujet, message } = req.body;
        if (!nom || !telephone || !message) {
            return res.status(400).json({ success: false, message: 'Nom, téléphone et message requis' });
        }

        const result = await db.query(
            'INSERT INTO messages (nom, telephone, email, sujet, message, date, lu) VALUES ($1, $2, $3, $4, $5, NOW(), false) RETURNING *',
            [nom, telephone, email || null, sujet || null, message]
        );

        return res.status(201).json({ success: true, message: 'Message envoyé avec succès', data: result.rows[0] });
    } catch (error) {
        console.error('Erreur send message:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function markRead(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID du message requis' });

        const result = await db.query('UPDATE messages SET lu = true WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Message non trouvé' });

        return res.status(200).json({ success: true, message: 'Message marqué comme lu', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur mark-read message:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID du message requis' });

        const result = await db.query('DELETE FROM messages WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Message non trouvé' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression du message ID ${id}`]
        );

        return res.status(200).json({ success: true, message: 'Message supprimé' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete message:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return getAll(req, res);
    if (req.method === 'POST') return send(req, res);
    if (req.method === 'PUT') return markRead(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
