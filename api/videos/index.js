const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');
const { uploadIfBase64 } = require('../lib/blob-upload');

// GET — publique.
// - ?produitId=X  -> vidéos d'un produit précis (fiche produit détaillée)
// - (sans filtre)  -> toutes les vidéos, avec infos produit/catégorie
//                     (utilisé par la page Galerie)
async function get(req, res) {
    try {
        const { produitId, limit = 100, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        if (produitId) {
            const result = await db.query(
                'SELECT * FROM videos WHERE produit_id = $1 ORDER BY ordre ASC, id ASC',
                [produitId]
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        const result = await db.query(`
            SELECT v.*, p.titre as produit_nom, c.nom as categorie_nom, c.slug as categorie_slug
            FROM videos v
            LEFT JOIN produits p ON p.id = v.produit_id
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY v.id DESC
            LIMIT $1 OFFSET $2
        `, [parseInt(limit), parseInt(offset)]);
        const countResult = await db.query('SELECT COUNT(*) FROM videos');

        return res.status(200).json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (error) {
        console.error('Erreur get videos:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

// POST — admin. La vidéo a déjà été envoyée vers Vercel Blob côté
// navigateur (voir upload-token.js) : ici on ne reçoit que son URL,
// à enregistrer en base.
async function create(req, res) {
    try {
        const user = requireAuth(req);
        const { url, produitId, titre, description, posterUrl } = req.body;

        if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
            return res.status(400).json({ success: false, message: 'URL de vidéo invalide.' });
        }

        // La miniature est capturée côté navigateur (canvas) au moment de
        // l'upload et envoyée ici en base64 : on la bascule vers Vercel Blob
        // comme n'importe quelle image (voir blob-upload.js). Optionnelle :
        // si la capture a échoué (ancien navigateur, etc.), on enregistre
        // simplement la vidéo sans miniature — l'affichage retombe alors sur
        // l'ancien comportement (aperçu généré par le navigateur du visiteur).
        const finalPosterUrl = await uploadIfBase64(posterUrl, 'videos-posters');

        const maxOrdreResult = await db.query(
            'SELECT COALESCE(MAX(ordre), -1) as m FROM videos WHERE produit_id IS NOT DISTINCT FROM $1',
            [produitId || null]
        );
        const ordre = maxOrdreResult.rows[0].m + 1;

        const result = await db.query(
            'INSERT INTO videos (produit_id, url, titre, description, ordre, poster_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [produitId || null, url, titre || null, description || null, ordre, finalPosterUrl || null]
        );

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Ajout d'une vidéo${titre ? ' "' + titre + '"' : ''}`]
        );

        return res.status(201).json({ success: true, message: 'Vidéo enregistrée avec succès', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur create video:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID de la vidéo requis' });

        const { titre, description, produitId, ordre, posterUrl } = req.body;
        const finalPosterUrl = posterUrl !== undefined ? await uploadIfBase64(posterUrl, 'videos-posters') : undefined;
        const result = await db.query(
            'UPDATE videos SET titre = $1, description = $2, produit_id = $3, ordre = COALESCE($4, ordre), poster_url = COALESCE($6, poster_url) WHERE id = $5 RETURNING *',
            [titre || null, description || null, produitId || null, ordre, id, finalPosterUrl || null]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Vidéo non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Modification de la vidéo ID ${id}`]
        );

        return res.status(200).json({ success: true, message: 'Vidéo mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update video:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        const user = requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID de la vidéo requis' });

        // On ne supprime pas le fichier sur Vercel Blob (même logique que
        // pour les images) : le volume de stockage reste très faible.
        const result = await db.query('DELETE FROM videos WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Vidéo non trouvée' });

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, `Suppression de la vidéo ID ${id}`]
        );

        return res.status(200).json({ success: true, message: 'Vidéo supprimée' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete video:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return get(req, res);
    if (req.method === 'POST') return create(req, res);
    if (req.method === 'PUT') return update(req, res);
    if (req.method === 'DELETE') return remove(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
