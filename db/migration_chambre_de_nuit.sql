-- ============================================================
-- Ajoute la catégorie "Chambre de nuit" (chambres à coucher).
-- Aucune autre modification de base n'est nécessaire : les
-- produits, l'API (/api/produits/chambre-de-nuit) et la page
-- (/produits/chambre-de-nuit.html) fonctionnent automatiquement
-- pour toute catégorie présente dans cette table.
-- ============================================================

INSERT INTO categories (nom, slug, icone) VALUES
('Chambre de nuit', 'chambre-de-nuit', 'fa-bed')
ON CONFLICT (slug) DO NOTHING;
