const { applyCors } = require('./lib/cors');

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    const url = req.url;

    // Auth
    if (url.startsWith('/api/auth')) {
        const handler = require('./auth/index');
        return handler(req, res);
    }

    // Categories
    if (url.startsWith('/api/categories')) {
        const handler = require('./categories/index');
        return handler(req, res);
    }

    // Produits
    if (url.startsWith('/api/produits')) {
        const handler = require('./produits/index');
        return handler(req, res);
    }

    // Galerie
    if (url.startsWith('/api/galerie')) {
        const handler = require('./galerie/index');
        return handler(req, res);
    }

    // Avis clients
    if (url.startsWith('/api/avis')) {
        const handler = require('./avis/index');
        return handler(req, res);
    }

    // Messages
    if (url.startsWith('/api/messages')) {
        const handler = require('./messages/index');
        return handler(req, res);
    }

    // Admins
    if (url.startsWith('/api/admins') || url.startsWith('/api/utilisateurs')) {
        const handler = require('./utilisateurs/index');
        return handler(req, res);
    }

    // Parametres
    if (url.startsWith('/api/parametres')) {
        const handler = require('./parametres/index');
        return handler(req, res);
    }

    // Logs
    if (url.startsWith('/api/logs')) {
        const handler = require('./logs/index');
        return handler(req, res);
    }

    return res.status(404).json({ success: false, message: 'Endpoint non trouvé' });
};
