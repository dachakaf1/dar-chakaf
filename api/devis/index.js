const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

let tableReady = false;

async function ensureTable() {
    if (tableReady) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS devis_requests (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            telephone VARCHAR(50) NOT NULL,
            email VARCHAR(255),
            ville VARCHAR(120),
            message TEXT,
            produits JSONB NOT NULL DEFAULT '[]',
            statut VARCHAR(50) DEFAULT 'nouveau',
            lu BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis_requests(statut)`);
    tableReady = true;
}

async function getAll(req, res) {
    try {
        requireAuth(req);
        await ensureTable();
        const { statut, limit = 50 } = req.query;
        let query = 'SELECT * FROM devis_requests';
        const params = [];
        if (statut) {
            query += ' WHERE statut = $1';
            params.push(statut);
        }
        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get-all devis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        await ensureTable();
        const { nom, telephone, email, ville, message, produits } = req.body;
        if (!nom || !telephone) {
            return res.status(400).json({ success: false, message: 'Nom et téléphone requis' });
        }
        if (!Array.isArray(produits) || produits.length === 0) {
            return res.status(400).json({ success: false, message: 'Veuillez sélectionner au moins un produit' });
        }

        const result = await db.query(
            `INSERT INTO devis_requests (nom, telephone, email, ville, message, produits, statut, lu, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'nouveau', false, NOW()) RETURNING *`,
            [nom, telephone, email || null, ville || null, message || null, JSON.stringify(produits)]
        );

        return res.status(201).json({ success: true, message: 'Demande de devis envoyée avec succès', data: result.rows[0] });
    } catch (error) {
        console.error('Erreur create devis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const { statut, lu } = req.body;
        const fields = [];
        const params = [];
        let idx = 1;
        if (statut !== undefined) { fields.push(`statut = $${idx++}`); params.push(statut); }
        if (lu !== undefined) { fields.push(`lu = $${idx++}`); params.push(lu); }
        if (fields.length === 0) return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });

        params.push(id);
        const result = await db.query(
            `UPDATE devis_requests SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        return res.status(200).json({ success: true, message: 'Demande mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update devis:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM devis_requests WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        return res.status(200).json({ success: true, message: 'Demande supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete devis:', error);
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
