-- ============================================================
-- Remplace la section "Notre histoire" de la page À propos par
-- une section "Nos offres" : affiche (image) + titre + description
-- + compte à rebours, 100% pilotable depuis l'admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS about_offers (
    id SERIAL PRIMARY KEY,
    image TEXT,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    countdown_end TIMESTAMP,
    ordre INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
