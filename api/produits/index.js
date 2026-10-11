const { applyCors } = require('../lib/cors');

// Catégories historiques qui ont chacune leur propre fichier
// (logique métier identique à generic.js, gardées telles quelles
// pour ne rien casser sur l'existant).
//
// IMPORTANT : ces require() sont volontairement écrits en clair (pas de
// require(variable)) et chargés une seule fois ici, en haut du fichier.
// Le "require dynamique" require(LEGACY_HANDLERS[slug]) qu'il y avait
// avant fonctionne très bien en local, mais l'outil qui empaquette les
// fonctions pour Vercel (@vercel/nft) ne détecte pas toujours ce genre
// de require() construit à partir d'une variable — résultat : certains
// fichiers (salons-modernes.js, meubles-tv.js) n'étaient pas inclus dans
// le déploiement, d'où l'erreur "Cannot find module" en production alors
// que tout marchait en local.
const salonsModernes = require('./salons-modernes');
const salonsTraditionnels = require('./salons-traditionnels');
const tables = require('./tables');
const decorations = require('./decorations');
const meublesTv = require('./meubles-tv');
const couloirs = require('./couloirs');
const tissus = require('./tissus');
const getOne = require('./get-one');
const top = require('./top');
const generic = require('./generic');

const LEGACY_HANDLERS = {
    'salons-modernes': salonsModernes,
    'salons-traditionnels': salonsTraditionnels,
    'tables': tables,
    'decorations': decorations,
    'meubles-tv': meublesTv,
    'couloirs': couloirs,
    'tissus': tissus
};

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    // req.url ressemble à "/get-one?id=12" ou "/nouvelle-categorie?id=5"
    // (le préfixe /api/produits est déjà consommé par le routeur).
    const pathOnly = req.url.split('?')[0];
    const slug = pathOnly.replace(/^\/+/, '').replace(/\/+$/, '');

    if (slug === 'get-one') {
        return getOne(req, res);
    }
    if (slug === 'top') {
        return top(req, res);
    }
    if (LEGACY_HANDLERS[slug]) {
        return LEGACY_HANDLERS[slug](req, res);
    }

    // Toute autre catégorie (créée depuis l'admin) passe par le
    // handler générique — aucun code à écrire pour qu'elle fonctionne.
    if (slug) {
        return generic(req, res, slug);
    }

    return res.status(404).json({ success: false, message: 'Endpoint non trouvé' });
};
