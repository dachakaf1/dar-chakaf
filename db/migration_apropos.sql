-- ============================================================
-- Rend la page "À propos" 100% pilotable depuis l'admin :
--  - about_page   : les textes (un seul rang, comme site_settings)
--  - about_values : les cartes "Nos valeurs" (nombre libre, 2, 3, 4...)
-- ============================================================

CREATE TABLE IF NOT EXISTS about_page (
    id SERIAL PRIMARY KEY,
    hero_title VARCHAR(255) DEFAULT 'Notre histoire',
    hero_subtitle TEXT DEFAULT 'Découvrez l''âme de Dar Chakaf — un savoir-faire marocain transmis de génération en génération.',
    badge_number VARCHAR(20) DEFAULT '15',
    badge_text VARCHAR(255) DEFAULT 'Ans de savoir-faire artisanal',
    story_eyebrow VARCHAR(255) DEFAULT 'Notre histoire',
    story_title VARCHAR(255) DEFAULT 'Chaque pièce raconte un savoir-faire transmis',
    story_lede TEXT DEFAULT '« Chakaf » désigne la structure, l''ossature d''un meuble bien construit — c''est le nom que nous avons choisi pour notre maison.',
    story_desc1 TEXT DEFAULT 'Depuis notre atelier, nous fabriquons des meubles qui allient la précision des lignes contemporaines à la richesse du geste artisanal marocain.',
    story_desc2 TEXT DEFAULT 'Chaque création est pensée pour s''intégrer harmonieusement dans votre intérieur, avec des matériaux nobles et des finitions faites main.',
    story_cta_text VARCHAR(255) DEFAULT 'Visiter notre showroom',
    values_eyebrow VARCHAR(255) DEFAULT 'Nos valeurs',
    values_title VARCHAR(255) DEFAULT 'Ce qui nous anime',
    values_desc TEXT DEFAULT 'Les principes qui guident chaque création, du premier trait au dernier geste.',
    stat_years_label VARCHAR(255) DEFAULT 'Années d''expérience',
    stat_projects_label VARCHAR(255) DEFAULT 'Projets réalisés',
    stat_collections_label VARCHAR(255) DEFAULT 'Collections',
    stat_extra_value VARCHAR(50) DEFAULT '100%',
    stat_extra_label VARCHAR(255) DEFAULT 'Fabrication sur mesure',
    cta_eyebrow VARCHAR(255) DEFAULT 'Prêt à collaborer ?',
    cta_title VARCHAR(255) DEFAULT 'Donnons vie à votre intérieur',
    cta_desc TEXT DEFAULT 'Nos artisans sont prêts à concevoir avec vous des pièces uniques, pensées pour durer.',
    cta_button_text VARCHAR(255) DEFAULT 'Demander un devis',
    cta_button_link VARCHAR(255) DEFAULT '/contact.html',
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO about_page (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS about_values (
    id SERIAL PRIMARY KEY,
    icone VARCHAR(100) DEFAULT 'fa-gem',
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO about_values (icone, titre, description, ordre)
SELECT * FROM (VALUES
    ('fa-hands', 'Artisanat d''exception', 'Chaque meuble est façonné à la main par nos artisans, avec une attention méticuleuse à chaque détail.', 1),
    ('fa-leaf', 'Matériaux nobles', 'Bois massifs sélectionnés, tissus premium et finitions durables pour un mobilier qui traverse le temps.', 2),
    ('fa-heart', 'Sur mesure', 'Chaque projet est unique. Nous adaptons dimensions, matériaux et finitions à vos envies et votre espace.', 3)
) AS seed(icone, titre, description, ordre)
WHERE NOT EXISTS (SELECT 1 FROM about_values);
