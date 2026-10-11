const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

const FIELDS = [
    'hero_title', 'hero_subtitle', 'badge_number', 'badge_text',
    'story_eyebrow', 'story_title', 'story_lede', 'story_desc1', 'story_desc2', 'story_cta_text', 'story_image',
    'values_eyebrow', 'values_title', 'values_desc',
    'stat_years_label', 'stat_projects_label', 'stat_collections_label', 'stat_extra_value', 'stat_extra_label',
    'cta_eyebrow', 'cta_title', 'cta_desc', 'cta_button_text', 'cta_button_link'
];

async function get(req, res) {
    try {
        const result = await db.query('SELECT * FROM about_page ORDER BY id LIMIT 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Contenu "À propos" non initialisé' });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Erreur get about_page:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function update(req, res) {
    try {
        const user = requireAuth(req);
        const body = req.body || {};

        const sets = [];
        const params = [];
        let i = 1;
        FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                sets.push(`${field} = $${i}`);
                params.push(body[field]);
                i++;
            }
        });

        if (sets.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }

        sets.push('updated_at = NOW()');

        const result = await db.query(
            `UPDATE about_page SET ${sets.join(', ')} WHERE id = (SELECT id FROM about_page ORDER BY id LIMIT 1) RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            // Pas encore de ligne — on la crée avec les valeurs fournies.
            const cols = FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(body, f));
            const vals = cols.map((f) => body[f]);
            const placeholders = cols.map((_, idx) => `$${idx + 1}`);
            const inserted = await db.query(
                `INSERT INTO about_page (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
                vals
            );
            return res.status(200).json({ success: true, message: 'Contenu "À propos" créé', data: inserted.rows[0] });
        }

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, 'Mise à jour du contenu de la page À propos']
        );

        return res.status(200).json({ success: true, message: 'Page "À propos" mise à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update about_page:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') return get(req, res);
    if (req.method === 'PUT') return update(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
