-- Adds the editable "Notre histoire" image and the real client reviews table.
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS story_image TEXT;

CREATE TABLE IF NOT EXISTS avis_clients (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(120) NOT NULL,
    ville VARCHAR(120),
    note INTEGER DEFAULT 5 CHECK (note BETWEEN 1 AND 5),
    message TEXT NOT NULL,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
