-- ============================================================
-- MIGRATION — Vidéos (produits, galerie, page d'accueil)
-- ============================================================
-- Exécuter ce fichier sur la base PostgreSQL (Neon) AVANT de déployer
-- le nouveau code. Tout est écrit avec IF NOT EXISTS : sans risque de
-- le relancer plusieurs fois.

-- Table des vidéos liées à un produit (et affichées aussi dans la Galerie).
-- produit_id est NULLABLE : une vidéo "libre" (ajoutée depuis Admin > Galerie
-- sans être rattachée à un produit précis) reste possible.
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    produit_id INTEGER REFERENCES produits(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    titre VARCHAR(255),
    description TEXT,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_produit_id ON videos(produit_id);

-- Vidéo de fond optionnelle pour la page d'accueil (remplace le diaporama
-- d'images tant qu'elle est définie). Un seul champ, comme image_hero.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS video_hero TEXT;

-- Vidéo optionnelle pour la section "Notre histoire" (remplace la photo
-- story_image tant qu'elle est définie).
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS story_video TEXT;
