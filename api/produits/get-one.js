const db = require('../lib/db');
const { applyCors } = require('../lib/cors');
const { optionalAuth } = require('../lib/middleware-auth');
const { mergeMainImage } = require('../lib/merge-images');

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
    }
    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID du produit requis' });

        const result = await db.query(`
            SELECT p.*, c.nom as categorie_nom, c.slug as categorie_slug,
                   COALESCE(json_agg(i.url ORDER BY i.ordre) FILTER (WHERE i.url IS NOT NULL), '[]') as images
            FROM produits p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN images i ON i.produit_id = p.id
            WHERE p.id = $1
            GROUP BY p.id, c.nom, c.slug
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Produit non trouvé' });

        // Un brouillon ne doit pas être visible via un lien direct par un
        // visiteur normal (seul un admin connecté peut le prévisualiser).
        const product = result.rows[0];
        const isAdmin = !!optionalAuth(req);
        if (product.statut !== 'active' && !isAdmin) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        // Requête séparée (plutôt qu'un 2e LEFT JOIN dans la requête
        // ci-dessus) pour éviter de dupliquer les lignes d'images quand
        // un produit a plusieurs photos ET plusieurs vidéos à la fois.
        const videosResult = await db.query(
            'SELECT id, url, titre, description FROM videos WHERE produit_id = $1 ORDER BY ordre ASC, id ASC',
            [id]
        );
        product.videos = videosResult.rows;
        mergeMainImage(product);

        return res.status(200).json({ success: true, data: product });
    } catch (error) {
        console.error('Erreur get-one product:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
};
