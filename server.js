// ================================================================
// SERVER.JS — DAR CHAKAF API SERVER
// ================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// MIDDLEWARES
// ================================================================

// Désactive les ETags automatiques d'Express : sans ça, le navigateur
// peut recevoir un 304 Not Modified et réutiliser une vieille réponse
// en cache pour /api/apropos-offers (et les autres endpoints /api/*),
// même quand les données ont changé côté base de données.
app.set('etag', false);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Empêche toute mise en cache (navigateur ou CDN) des réponses API :
// on veut toujours les données les plus fraîches de la base.
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Empêche la mise en cache des scripts JS de l'admin (Safari/iOS garde
// très facilement une ancienne version en cache local, ce qui a déjà
// masqué des correctifs de l'upload vidéo lors de tests précédents).
// Peut être retiré une fois que les correctifs vidéo sont stabilisés.
app.use('/assets/js', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Site pages (frontend HTML) — served explicitly so server-side files
// like server.js, package.json, db/ and api/ are never exposed publicly.
app.use('/produits', express.static(path.join(__dirname, 'produits')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Repli automatique : toute catégorie créée depuis l'admin n'a pas de
// fichier .html dédié (et n'en aura jamais besoin). Si le fichier statique
// demandé n'existe pas, on sert la page générique correspondante à sa place —
// c'est ce qui permet à une nouvelle catégorie de fonctionner immédiatement,
// sans jamais toucher au code.
app.get(/^\/produits\/([a-z0-9-]+)\.html$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'produits', 'categorie.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile produits/categorie.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});
app.get(/^\/admin\/produits\/([a-z0-9-]+)\.html$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'produits', 'categorie.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile admin/produits/categorie.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/a-propos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'a-propos.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile a-propos.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});
app.get('/contact.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile contact.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});
app.get('/galerie.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'galerie.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile galerie.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});
app.get('/produit-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'produit-detail.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile produit-detail.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/favoris.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'favoris.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile favoris.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/comparateur.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'comparateur.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile comparateur.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/devis.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'devis.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile devis.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/blog.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile blog.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

app.get('/blog-article.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog-article.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile blog-article.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`📡 ${req.method} ${req.url}`);
        next();
    });
}

// ================================================================
// ROUTES API
// ================================================================

// Auth
app.post('/api/auth', async (req, res) => {
    try {
        const handler = require('./api/auth/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur auth POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.get('/api/auth', async (req, res) => {
    try {
        const handler = require('./api/auth/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur auth GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Categories
app.get('/api/categories', async (req, res) => {
    try {
        const handler = require('./api/categories/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur categories GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/categories', async (req, res) => {
    try {
        const handler = require('./api/categories/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur categories POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/categories', async (req, res) => {
    try {
        const handler = require('./api/categories/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur categories PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/categories', async (req, res) => {
    try {
        const handler = require('./api/categories/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur categories DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Produits
app.use('/api/produits', async (req, res) => {
    try {
        const handler = require('./api/produits/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur produits:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Galerie
app.get('/api/galerie', async (req, res) => {
    try {
        const handler = require('./api/galerie/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur galerie GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/galerie', async (req, res) => {
    try {
        const handler = require('./api/galerie/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur galerie POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/galerie', async (req, res) => {
    try {
        const handler = require('./api/galerie/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur galerie PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/galerie', async (req, res) => {
    try {
        const handler = require('./api/galerie/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur galerie DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Vidéos (produits, galerie) — jeton d'upload direct vers Vercel Blob
app.post('/api/videos/upload-token', async (req, res) => {
    try {
        const handler = require('./api/videos/upload-token');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur videos upload-token:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.get('/api/videos', async (req, res) => {
    try {
        const handler = require('./api/videos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur videos GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/videos', async (req, res) => {
    try {
        const handler = require('./api/videos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur videos POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/videos', async (req, res) => {
    try {
        const handler = require('./api/videos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur videos PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/videos', async (req, res) => {
    try {
        const handler = require('./api/videos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur videos DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Messages
app.get('/api/messages', async (req, res) => {
    try {
        const handler = require('./api/messages/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur messages GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/messages', async (req, res) => {
    try {
        const handler = require('./api/messages/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur messages POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/messages', async (req, res) => {
    try {
        const handler = require('./api/messages/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur messages PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/messages', async (req, res) => {
    try {
        const handler = require('./api/messages/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur messages DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Admins
app.get('/api/admins', async (req, res) => {
    try {
        const handler = require('./api/utilisateurs/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur admins GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/admins', async (req, res) => {
    try {
        const handler = require('./api/utilisateurs/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur admins POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/admins', async (req, res) => {
    try {
        const handler = require('./api/utilisateurs/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur admins PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/admins', async (req, res) => {
    try {
        const handler = require('./api/utilisateurs/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur admins DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Parametres
app.get('/api/parametres', async (req, res) => {
    try {
        const handler = require('./api/parametres/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur parametres GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/parametres', async (req, res) => {
    try {
        const handler = require('./api/parametres/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur parametres PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Images de fond — diaporama page d'accueil
app.get('/api/hero-images', async (req, res) => {
    try {
        const handler = require('./api/hero/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur hero-images GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/hero-images', async (req, res) => {
    try {
        const handler = require('./api/hero/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur hero-images POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/hero-images', async (req, res) => {
    try {
        const handler = require('./api/hero/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur hero-images PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/hero-images', async (req, res) => {
    try {
        const handler = require('./api/hero/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur hero-images DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// À propos — contenu de la page (textes)
app.get('/api/apropos', async (req, res) => {
    try {
        const handler = require('./api/apropos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/apropos', async (req, res) => {
    try {
        const handler = require('./api/apropos/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// À propos — cartes "Nos valeurs" (nombre libre)
app.get('/api/apropos-values', async (req, res) => {
    try {
        const handler = require('./api/apropos/values');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-values GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/apropos-values', async (req, res) => {
    try {
        const handler = require('./api/apropos/values');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-values POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/apropos-values', async (req, res) => {
    try {
        const handler = require('./api/apropos/values');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-values PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/apropos-values', async (req, res) => {
    try {
        const handler = require('./api/apropos/values');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-values DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// À propos — "Nos offres" (affiche + titre + description + compte à rebours)
app.get('/api/apropos-offers', async (req, res) => {
    try {
        const handler = require('./api/apropos/offers');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-offers GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/apropos-offers', async (req, res) => {
    try {
        const handler = require('./api/apropos/offers');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-offers POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/apropos-offers', async (req, res) => {
    try {
        const handler = require('./api/apropos/offers');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-offers PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/apropos-offers', async (req, res) => {
    try {
        const handler = require('./api/apropos/offers');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur apropos-offers DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Devis (demandes de devis multi-produits)
app.get('/api/devis', async (req, res) => {
    try {
        const handler = require('./api/devis/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur devis GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/devis', async (req, res) => {
    try {
        const handler = require('./api/devis/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur devis POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/devis', async (req, res) => {
    try {
        const handler = require('./api/devis/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur devis PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/devis', async (req, res) => {
    try {
        const handler = require('./api/devis/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur devis DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Newsletter
app.get('/api/newsletter', async (req, res) => {
    try {
        const handler = require('./api/newsletter/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur newsletter GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/newsletter', async (req, res) => {
    try {
        const handler = require('./api/newsletter/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur newsletter POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.patch('/api/newsletter', async (req, res) => {
    try {
        const handler = require('./api/newsletter/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur newsletter PATCH:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/newsletter', async (req, res) => {
    try {
        const handler = require('./api/newsletter/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur newsletter DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Blog / Actualités
app.get('/api/blog', async (req, res) => {
    try {
        const handler = require('./api/blog/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur blog GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.post('/api/blog', async (req, res) => {
    try {
        const handler = require('./api/blog/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur blog POST:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.put('/api/blog', async (req, res) => {
    try {
        const handler = require('./api/blog/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur blog PUT:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});
app.delete('/api/blog', async (req, res) => {
    try {
        const handler = require('./api/blog/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur blog DELETE:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'robots.txt'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile robots.txt:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement robots.txt');
        }
    });
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const db = require('./api/lib/db');
        const staticUrls = [
            { loc: '/', priority: '1.0' },
            { loc: '/a-propos.html', priority: '0.7' },
            { loc: '/contact.html', priority: '0.7' },
            { loc: '/galerie.html', priority: '0.7' },
            { loc: '/devis.html', priority: '0.5' },
            { loc: '/blog.html', priority: '0.6' }
        ];

        const categories = await db.query('SELECT slug, updated_at FROM categories');
        categories.rows.forEach((c) => {
            staticUrls.push({ loc: `/produits/${c.slug}.html`, priority: '0.8', lastmod: c.updated_at });
        });

        let produitUrls = [];
        try {
            const produits = await db.query("SELECT id, updated_at FROM produits WHERE statut = 'active'");
            produitUrls = produits.rows.map((p) => ({ loc: `/produit-detail.html?ref=${p.id}`, priority: '0.6', lastmod: p.updated_at }));
        } catch (e) { /* table might not have all fields yet */ }

        let blogUrls = [];
        try {
            const articles = await db.query("SELECT slug, updated_at FROM blog_articles WHERE statut = 'published'");
            blogUrls = articles.rows.map((a) => ({ loc: `/blog-article.html?slug=${a.slug}`, priority: '0.5', lastmod: a.updated_at }));
        } catch (e) { /* table might not exist yet on old DBs */ }

        const allUrls = [...staticUrls, ...produitUrls, ...blogUrls];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>https://darchakaf.ma${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (error) {
        console.error('❌ Erreur génération sitemap.xml:', error);
        res.status(500).send('Erreur génération du sitemap');
    }
});

// Logs
app.get('/api/logs', async (req, res) => {
    try {
        const handler = require('./api/logs/index');
        await handler(req, res);
    } catch (error) {
        console.error('❌ Erreur logs GET:', error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 Dar Chakaf API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: process.env.DATABASE_URL ? '✅ Connected' : '❌ Not configured'
    });
});

// Root — serves the actual homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            console.error('❌ Erreur sendFile index.html:', err.message);
            if (!res.headersSent) res.status(500).send('Erreur chargement page: ' + err.message);
        }
    });
});

// Filet de sécurité : certains liens/anciens favoris pointent vers
// /index.html directement (au lieu de /). On les redirige vers la
// racine pour éviter le 404 JSON.
app.get('/index.html', (req, res) => {
    res.redirect(301, '/');
});

// API info (moved off '/' so the homepage can be served there instead)
app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 Dar Chakaf API Server',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            categories: '/api/categories',
            produits: '/api/produits/:categorie',
            galerie: '/api/galerie',
            messages: '/api/messages',
            admins: '/api/admins',
            parametres: '/api/parametres',
            apropos: '/api/apropos',
            aproposValues: '/api/apropos-values',
            aproposOffers: '/api/apropos-offers',
            logs: '/api/logs',
            health: '/api/health'
        }
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '❌ Route non trouvée',
        path: req.path,
        method: req.method
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Erreur serveur:', err.stack);
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Token invalide' });
    }
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ================================================================
// START
// ================================================================

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const assetsDir = path.join(__dirname, 'public', 'assets');

// On Vercel the filesystem is read-only (except /tmp), so creating these
// folders at startup would throw and crash every single request. This is
// only useful for local dev, so it's wrapped in try/catch and skipped
// silently in production.
try {
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
} catch (err) {
    console.warn('⚠️  Impossible de créer les dossiers public/ (normal sur Vercel, filesystem read-only):', err.message);
}

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║   🚀  DAR CHAKAF API SERVER                            ║');
    console.log('║                                                          ║');
    console.log(`║   📍  http://localhost:${PORT}                           ║`);
    console.log(`║   🌍  Environment: ${process.env.NODE_ENV || 'development'}   ║`);
    console.log('║                                                          ║');
    console.log('║   📡  Endpoints disponibles:                            ║');
    console.log('║      POST   /api/auth              - Login              ║');
    console.log('║      GET    /api/auth              - Verify session     ║');
    console.log('║      GET    /api/categories        - Liste catégories   ║');
    console.log('║      POST   /api/categories        - Ajouter catégorie  ║');
    console.log('║      PUT    /api/categories        - Modifier catégorie ║');
    console.log('║      DELETE /api/categories        - Supprimer catégorie║');
    console.log('║      GET    /api/produits/*        - Produits           ║');
    console.log('║      GET    /api/galerie           - Liste images       ║');
    console.log('║      GET    /api/messages          - Liste messages     ║');
    console.log('║      GET    /api/admins            - Liste admins       ║');
    console.log('║      GET    /api/parametres        - Site settings      ║');
    console.log('║      GET    /api/logs              - Activity logs      ║');
    console.log('║      GET    /api/health            - Health check       ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ Serveur prêt à recevoir des requêtes');
});

module.exports = app;
