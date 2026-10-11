const db = require('../lib/db');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

async function countAdmins(req, res) {
    try {
        requireAuth(req);
        const result = await db.query("SELECT COUNT(*) FROM admins WHERE statut = 'active'");
        return res.status(200).json({ success: true, data: { count: parseInt(result.rows[0].count) } });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur count-admins:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function getSiteInfo(req, res) {
    try {
        const result = await db.query('SELECT * FROM site_settings LIMIT 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paramètres non initialisés' });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Erreur get-site-info:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

async function updateSiteInfo(req, res) {
    try {
        const user = requireAuth(req);
        const { logo, image_hero, story_image, adresse, maps_link, telephone, whatsapp, email, facebook, instagram, tiktok, linkedin, horaires, description, ga_measurement_id, tawkto_widget_id, video_hero, story_video } = req.body;

        const result = await db.query(`
            UPDATE site_settings
            SET logo = $1, image_hero = $2, adresse = $3, telephone = $4, whatsapp = $5,
                email = $6, facebook = $7, instagram = $8, tiktok = $9, horaires = $10,
                description = $11, maps_link = $12, linkedin = $13, story_image = $14,
                ga_measurement_id = $15, tawkto_widget_id = $16, video_hero = $17, story_video = $18, updated_at = NOW()
            WHERE id = (SELECT id FROM site_settings LIMIT 1)
            RETURNING *
        `, [logo, image_hero, adresse, telephone, whatsapp, email, facebook, instagram, tiktok, horaires, description, maps_link, linkedin, story_image, ga_measurement_id || null, tawkto_widget_id || null, video_hero || null, story_video || null]);

        await db.query(
            'INSERT INTO activity_logs (admin_id, action, date) VALUES ($1, $2, NOW())',
            [user.id, 'Mise à jour des paramètres du site']
        );

        return res.status(200).json({ success: true, message: 'Paramètres mis à jour', data: result.rows[0] });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return res.status(401).json({ success: false, message: 'Non autorisé' });
        console.error('Erreur update-site-info:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method === 'GET') {
        if (req.query.info === 'count-admins') return countAdmins(req, res);
        return getSiteInfo(req, res);
    }
    if (req.method === 'PUT') return updateSiteInfo(req, res);
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
};
