-- ================================================================
-- MIGRATION — Ajout du lien LinkedIn dans site_settings
-- À exécuter UNE SEULE FOIS sur la base de données déjà en ligne
-- (schema.sql seul ne suffit pas si la table existe déjà).
-- ================================================================
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255);
