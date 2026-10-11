const db = require('../lib/db');
const { applyCors } = require('../lib/cors');
const { mergeMainImageMany } = require('../lib/merge-images');

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
    }
    try {
        const { limit = 5 } = req.query;
        const result = await db.query(`
            SELECT p.*, c.nom as categorie_nom, c.slug as categorie_slug,
                   COALESCE(json_agg(i.url ORDER BY i.ordre) FILTER (WHERE i.url IS NOT NULL), '[]') as images
            FROM produits p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN images i ON i.produit_id = p.id
            WHERE p.statut = 'active'
            GROUP BY p.id, c.nom, c.slug
            ORDER BY p.ordre ASC, p.id DESC
            LIMIT $1
        `, [parseInt(limit)]);

        return res.status(200).json({ success: true, data: mergeMainImageMany(result.rows) });
    } catch (error) {
        console.error('Erreur top products:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
};
