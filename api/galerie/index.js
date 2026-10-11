const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const { deleteImage, uploadImage } = require('../lib/image-handler');

async function get(req, res) {
    try {
        const { category, limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT i.*, p.titre as produit_nom, c.nom as categorie_nom, c.slug as categorie_slug
            FROM images i
            LEFT JOIN produits p ON p.id = i.produit_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        if (category && category !== 'all') {
            query += ` AND c.slug = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        query += ` ORDER BY i.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);
        const countResult = await db.query('SELECT COUNT(*) FROM images');

        return res.status(200).json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (error) {
        console.error('Erreur get gallery:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function upload(req, res) {
    try {
        const user = requireAuth(req);
        const { imageUrl, produitId, titre, description } = req.body;
        if (!imageUrl) return res.status(400).json({ success: false, message: "URL de l'image requise" });

        const uploadResult = await uploadImage(imageUrl, 'gallery');
        const result = await db.query(
            'INSERT INTO images (produit_id, url, titre, description, ordre) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [produitId || null, uploadResult.url, titre || null, description || null, 0]
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Upload de l'image "${titre || 'sans titre'}"`]
        );

        return res.status(201).json({ success: true, message: 'Image uploadée avec succès', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        if (error.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ success: false, message: 'Image trop volumineuse (max ~5 Mo).' });
        if (error.message === 'BLANK_IMAGE') return res.status(400).json({ success: false, message: "Cette photo n'a pas pu être lue correctement, réessayez." });
        if (error.message === 'INVALID_IMAGE') return res.status(400).json({ success: false, message: "Format d'image invalide. Utilisez un fichier image ou un lien https://..." });
        console.error('Erreur upload image:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: "ID de l'image requis" });

        const { titre, description, produitId } = req.body;
        const result = await db.query(
            'UPDATE images SET titre = $1, description = $2, produit_id = $3 WHERE id = $4 RETURNING *',
            [titre || null, description || null, produitId || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Image non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Modification de l'image ID ${id}`]
        );

        return res.status(200).json({ success: true, message: 'Image mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update image:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function cleanupBlank(req, res) {
    try {
        const user = requireAuth(req);
        // Une image valide (data URI compressée ou lien http/https) fait toujours plus
        // de 30 caractères ; ça attrape les lignes vides/cassées créées avant le fix.
        const result = await db.query(
            "DELETE FROM images WHERE url IS NULL OR LENGTH(url) < 30 RETURNING id"
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Nettoyage de ${result.rows.length} image(s) cassée(s)`]
        );

        return res.status(200).json({ success: true, message: `${result.rows.length} image(s) cassée(s) supprimée(s)`, count: result.rows.length });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur cleanup images:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: "ID de l'image requis" });

        const imageResult = await db.query('SELECT url FROM images WHERE id = $1', [id]);
        if (imageResult.rows.length > 0) await deleteImage(imageResult.rows[0].url);

        const result = await db.query('DELETE FROM images WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Image non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression de l'image ID ${id}`]
        );

        return res.status(200).json({ success: true, message: 'Image supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete image:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return get(req, res);
    if (req.method === 'POST') return upload(req, res);
    if (req.method === 'PUT') return update(req, res);
    if (req.method === 'DELETE') {
        if (req.query.cleanup) return cleanupBlank(req, res);
        return remove(req, res);
    }
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
