const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

let categoryCoverColumnReady = false;

async function ensureCategoryCoverColumn() {
    if (categoryCoverColumnReady) return;
    await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_couverture TEXT');
    await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS nom_ar VARCHAR(255)');
    categoryCoverColumnReady = true;
}

async function getAll(req, res) {
    try {
        await ensureCategoryCoverColumn();
        const result = await db.query(`
            SELECT
                c.*,
                COUNT(p.id) as product_count,
                COALESCE(NULLIF(c.image_couverture, ''), cover.cover_image) as cover_image
            FROM categories c
            LEFT JOIN produits p ON p.category_id = c.id
            LEFT JOIN LATERAL (
                SELECT COALESCE(i.url, NULLIF(p2.image_principale, '')) as cover_image
                FROM produits p2
                LEFT JOIN images i ON i.produit_id = p2.id
                WHERE p2.category_id = c.id
                  AND COALESCE(i.url, NULLIF(p2.image_principale, '')) IS NOT NULL
                ORDER BY
                    CASE WHEN p2.statut = 'active' THEN 0 ELSE 1 END,
                    p2.ordre ASC,
                    p2.id DESC,
                    i.ordre ASC NULLS LAST,
                    i.id ASC NULLS LAST
                LIMIT 1
            ) cover ON true
            GROUP BY c.id, cover.cover_image
            ORDER BY c.id
        `);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur get-all categories:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        requireAuth(req);
        await ensureCategoryCoverColumn();
        const { nom, slug, icone, image_couverture, nom_ar } = req.body;
        if (!nom || !slug) {
            return res.status(400).json({ success: false, message: 'Nom et slug requis' });
        }
        const result = await db.query(
            'INSERT INTO categories (nom, slug, icone, image_couverture, nom_ar) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nom, slug, icone || null, image_couverture || null, nom_ar || null]
        );
        return res.status(201).json({ success: true, message: 'Catégorie créée avec succès', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur create category:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        await ensureCategoryCoverColumn();
        const { nom, slug, icone, image_couverture, nom_ar } = req.body;
        if (!id) return res.status(400).json({ success: false, message: 'ID de la catégorie requis' });

        const result = await db.query(
            'UPDATE categories SET nom = $1, slug = $2, icone = $3, image_couverture = $4, nom_ar = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
            [nom, slug, icone, image_couverture || null, nom_ar || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
        return res.status(200).json({ success: true, message: 'Catégorie mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update category:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID de la catégorie requis' });

        const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
        return res.status(200).json({ success: true, message: 'Catégorie supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete category:', error);
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
