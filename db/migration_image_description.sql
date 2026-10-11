-- Adds an editable description field for each gallery image.
ALTER TABLE images
ADD COLUMN IF NOT EXISTS description TEXT;
