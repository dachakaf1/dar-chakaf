const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

async function list(req, res) {
    try {
        const result = await db.query('SELECT * FROM about_values ORDER BY ordre ASC, id ASC');
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur list about_values:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        const user = requireAuth(req);
        const { icone, titre, description, ordre } = req.body || {};
        if (!titre) return res.status(400).json({ success: false, message: 'Le titre est requis' });

        const result = await db.query(
            'INSERT INTO about_values (icone, titre, description, ordre) VALUES ($1, $2, $3, $4) RETURNING *',
            [icone || 'fa-gem', titre, description || null, Number.isFinite(ordre) ? ordre : 0]
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Ajout de la valeur "${titre}" (page À propos)`]
        );

        return res.status(201).json({ success: true, message: 'Valeur ajoutée', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur create about_value:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const { icone, titre, description, ordre } = req.body || {};
        const result = await db.query(
            'UPDATE about_values SET icone = $1, titre = $2, description = $3, ordre = $4 WHERE id = $5 RETURNING *',
            [icone || 'fa-gem', titre, description || null, Number.isFinite(ordre) ? ordre : 0, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Valeur non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Modification de la valeur ID ${id} (page À propos)`]
        );

        return res.status(200).json({ success: true, message: 'Valeur mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update about_value:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM about_values WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Valeur non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression de la valeur ID ${id} (page À propos)`]
        );

        return res.status(200).json({ success: true, message: 'Valeur supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete about_value:', error);
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
