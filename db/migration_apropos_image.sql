-- ============================================================
-- Ajoute la photo de la section "Nos produits" de la page À propos.
-- Avant cette migration, cette zone affichait un marteau 🔨 codé en
-- dur car aucune colonne n'existait pour stocker une vraie image.
-- ============================================================

ALTER TABLE about_page ADD COLUMN IF NOT EXISTS story_image TEXT;
