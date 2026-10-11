-- ============================================================
-- DAR CHAKAF — Migration: nouvelles fonctionnalités
-- (Devis, Newsletter, Blog, Avis+photos, Produits/Catégories multilingues)
-- ============================================================

-- 1. DEMANDES DE DEVIS (multi-produits)
CREATE TABLE IF NOT EXISTS devis_requests (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    telephone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    ville VARCHAR(120),
    message TEXT,
    produits JSONB NOT NULL DEFAULT '[]',  -- [{id, titre, image, prix, quantite}]
    statut VARCHAR(50) DEFAULT 'nouveau',  -- nouveau | en_cours | traite
    lu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. NEWSLETTER
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    statut VARCHAR(50) DEFAULT 'active', -- active | unsubscribed
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. BLOG / ACTUALITÉS
CREATE TABLE IF NOT EXISTS blog_articles (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    extrait TEXT,
    contenu TEXT NOT NULL,
    image_couverture TEXT,
    auteur VARCHAR(120) DEFAULT 'Dar Chakaf',
    statut VARCHAR(50) DEFAULT 'draft', -- draft | published
    meta_description VARCHAR(300),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP
);

-- 4. AVIS CLIENTS — support des photos
ALTER TABLE avis_clients ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- 5. PRODUITS — champs multilingues (AR) + SEO
ALTER TABLE produits ADD COLUMN IF NOT EXISTS titre_ar VARCHAR(255);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS description_ar TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS meta_description VARCHAR(300);

-- 6. CATEGORIES — champs multilingues (AR)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS nom_ar VARCHAR(255);

-- 7. SITE SETTINGS — Analytics / Chat IDs (configurables depuis l'admin, pas en dur dans le code)
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ga_measurement_id VARCHAR(50);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tawkto_widget_id VARCHAR(100);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis_requests(statut);
CREATE INDEX IF NOT EXISTS idx_blog_statut ON blog_articles(statut);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_articles(slug);
