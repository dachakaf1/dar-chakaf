const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
    }
    try {
        requireAuth(req);
        const { limit = 100 } = req.query;

        const result = await db.query(`
            SELECT l.id, l.action, l.date, a.email as user_email
            FROM activity_logs l
            LEFT JOIN admins a ON a.id = l.admin_id
            ORDER BY l.date DESC
            LIMIT $1
        `, [parseInt(limit)]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get logs:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
};
