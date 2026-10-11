const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const bcrypt = require('bcryptjs');

async function getAll(req, res) {
    try {
        requireAuth(req);
        const result = await db.query('SELECT id, nom, email, role, statut, created_at FROM admins ORDER BY id');
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get-all admins:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        const user = requireAuth(req);
        const { nom, email, mot_de_passe, role, statut } = req.body;
        if (!nom || !email || !mot_de_passe) {
            return res.status(400).json({ success: false, message: 'Nom, email et mot de passe requis' });
        }

        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        const result = await db.query(
            'INSERT INTO admins (nom, email, mot_de_passe_hash, role, statut) VALUES ($1, $2, $3, $4, $5) RETURNING id, nom, email, role, statut',
            [nom, email, hashedPassword, role || 'admin', statut || 'active']
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Ajout de l'admin "${email}"`]
        );

        return res.status(201).json({ success: true, message: 'Admin créé avec succès', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur create admin:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        const { nom, email, role, statut } = req.body;
        if (!id) return res.status(400).json({ success: false, message: 'ID de l\'admin requis' });

        const result = await db.query(
            'UPDATE admins SET nom = $1, email = $2, role = $3, statut = $4, updated_at = NOW() WHERE id = $5 RETURNING id, nom, email, role, statut',
            [nom, email, role, statut, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin non trouvé' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Modification de l'admin "${email}"`]
        );

        return res.status(200).json({ success: true, message: 'Admin mis à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update admin:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID de l\'admin requis' });

        const adminResult = await db.query('SELECT email FROM admins WHERE id = $1', [id]);
        const adminEmail = adminResult.rows[0]?.email || 'Admin';

        const result = await db.query('DELETE FROM admins WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin non trouvé' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression de l'admin "${adminEmail}"`]
        );

        return res.status(200).json({ success: true, message: 'Admin supprimé' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete admin:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return getAll(req, res);
    if (req.method === 'POST') return create(req, res);
    if (req.method === 'PUT') return update(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
