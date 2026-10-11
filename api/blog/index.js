const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function getAll(req, res) {
    try {
        const { slug, id, admin } = req.query;
        let isAdmin = false;
        if (admin === '1') {
            try { requireAuth(req); isAdmin = true; } catch (e) { isAdmin = false; }
        }

        if (slug) {
            const result = await db.query(
                'SELECT * FROM blog_articles WHERE slug = $1' + (isAdmin ? '' : " AND statut = 'published'"),
                [slug]
            );
            if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Article non trouvé' });
            return res.status(200).json({ success: true, data: result.rows[0] });
        }
        if (id) {
            requireAuth(req);
            const result = await db.query('SELECT * FROM blog_articles WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Article non trouvé' });
            return res.status(200).json({ success: true, data: result.rows[0] });
        }

        let query = 'SELECT id, titre, slug, extrait, image_couverture, auteur, statut, created_at, published_at FROM blog_articles';
        if (!isAdmin) query += " WHERE statut = 'published'";
        query += ' ORDER BY COALESCE(published_at, created_at) DESC';

        const result = await db.query(query);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur get-all blog:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function create(req, res) {
    try {
        requireAuth(req);
        const { titre, extrait, contenu, image_couverture, auteur, statut, meta_description } = req.body;
        if (!titre || !contenu) {
            return res.status(400).json({ success: false, message: 'Titre et contenu requis' });
        }
        const slug = slugify(titre) + '-' + Date.now().toString(36);
        const finalStatut = statut === 'published' ? 'published' : 'draft';
        const publishedAt = finalStatut === 'published' ? new Date() : null;

        const result = await db.query(
            `INSERT INTO blog_articles (titre, slug, extrait, contenu, image_couverture, auteur, statut, meta_description, published_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
            [titre, slug, extrait || null, contenu, image_couverture || null, auteur || 'Dar Chakaf', finalStatut, meta_description || null, publishedAt]
        );
        return res.status(201).json({ success: true, message: 'Article créé', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur create blog:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const { titre, extrait, contenu, image_couverture, auteur, statut, meta_description } = req.body;

        const existing = await db.query('SELECT * FROM blog_articles WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Article non trouvé' });

        const was = existing.rows[0];
        const finalStatut = statut || was.statut;
        const publishedAt = (finalStatut === 'published' && was.statut !== 'published') ? new Date() : was.published_at;

        const result = await db.query(
            `UPDATE blog_articles SET titre=$1, extrait=$2, contenu=$3, image_couverture=$4, auteur=$5, statut=$6, meta_description=$7, published_at=$8, updated_at=NOW()
             WHERE id=$9 RETURNING *`,
            [titre || was.titre, extrait ?? was.extrait, contenu || was.contenu, image_couverture ?? was.image_couverture,
             auteur || was.auteur, finalStatut, meta_description ?? was.meta_description, publishedAt, id]
        );
        return res.status(200).json({ success: true, message: 'Article mis à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update blog:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function remove(req, res) {
    try {
        requireAuth(req);
        const { id } = req.query;
        if (!id) return res.status(400).json({ success: false, message: 'ID requis' });

        const result = await db.query('DELETE FROM blog_articles WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Article non trouvé' });
        return res.status(200).json({ success: true, message: 'Article supprimé' });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur delete blog:', error);
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
