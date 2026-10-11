// ============================================================
// MIGRATION : convertit toutes les images stockées en base64
// directement dans Postgres (colonnes TEXT) vers Vercel Blob
// Storage. On ne garde en base que le lien (URL).
//
// Ceci corrige les PRODUITS/PHOTOS DÉJÀ EN LIGNE (créés avant la
// mise à jour du code) — les nouveaux produits utilisent déjà
// Blob automatiquement, ce script est un rattrapage ponctuel.
//
// À LANCER UNE SEULE FOIS, EN LOCAL (pas sur Vercel).
//
// PRÉREQUIS avant de lancer :
//   1. npm install (pour avoir pg et @vercel/blob installés)
//   2. Un fichier .env à la racine du projet avec :
//        DATABASE_URL=postgres://...      (copié depuis Neon ou Vercel)
//        BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...  (copié depuis Vercel → Storage → daar-chakaf-blob → .env.local)
//
// LANCEMENT :
//   node db/migrate-images-to-blob.js
//
// Le script affiche un résumé (combien d'images trouvées/migrées)
// et NE TOUCHE À RIEN d'autre que les colonnes listées ci-dessous.
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const { put } = require('@vercel/blob');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Chaque entrée : table, colonne clé primaire, colonne à migrer, dossier Blob
const TARGETS = [
    { table: 'produits', idCol: 'id', col: 'image_principale', folder: 'produits' },
    { table: 'images', idCol: 'id', col: 'url', folder: 'produits' },
    { table: 'hero_images', idCol: 'id', col: 'url', folder: 'hero' },
    { table: 'about_offers', idCol: 'id', col: 'image', folder: 'offer' },
    { table: 'site_settings', idCol: 'id', col: 'logo', folder: 'site' },
    { table: 'site_settings', idCol: 'id', col: 'image_hero', folder: 'site' },
    { table: 'site_settings', idCol: 'id', col: 'story_image', folder: 'site' },
    { table: 'categories', idCol: 'id', col: 'image_couverture', folder: 'categories' }
];

function parseDataUri(dataUri) {
    const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUri);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function migrateColumn({ table, idCol, col, folder }) {
    const { rows } = await pool.query(
        `SELECT ${idCol} as id, ${col} as val FROM ${table} WHERE ${col} LIKE 'data:image%'`
    );

    if (rows.length === 0) {
        console.log(`  ${table}.${col} : rien à migrer`);
        return { found: 0, migrated: 0, failed: 0 };
    }

    console.log(`  ${table}.${col} : ${rows.length} image(s) base64 trouvée(s)`);
    let migrated = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            const parsed = parseDataUri(row.val);
            if (!parsed) throw new Error('format data URI non reconnu');

            const ext = (parsed.contentType.split('/')[1] || 'jpg').replace('+xml', '');
            const filename = `${folder}/migrated-${table}-${row.id}-${Date.now()}.${ext}`;

            const blob = await put(filename, parsed.buffer, {
                access: 'public',
                contentType: parsed.contentType,
                addRandomSuffix: false
            });

            await pool.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [blob.url, row.id]);
            migrated++;
            process.stdout.write('.');
        } catch (err) {
            failed++;
            console.error(`\n    Erreur ${table}.${col} id=${row.id} : ${err.message}`);
        }
    }
    console.log(`\n  → ${migrated} migrée(s), ${failed} échec(s)`);
    return { found: rows.length, migrated, failed };
}

async function main() {
    console.log('=== Migration des images base64 vers Vercel Blob ===\n');

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL manquant (mets-le dans un fichier .env)');
        process.exit(1);
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('BLOB_READ_WRITE_TOKEN manquant (mets-le dans un fichier .env)');
        process.exit(1);
    }

    let totalFound = 0, totalMigrated = 0, totalFailed = 0;

    for (const target of TARGETS) {
        try {
            const r = await migrateColumn(target);
            totalFound += r.found;
            totalMigrated += r.migrated;
            totalFailed += r.failed;
        } catch (err) {
            // Table/colonne inexistante selon les migrations déjà appliquées : on ignore et on continue
            console.log(`  ${target.table}.${target.col} : ignoré (${err.message})`);
        }
    }

    console.log('\n=== Résumé ===');
    console.log(`Trouvées : ${totalFound}`);
    console.log(`Migrées  : ${totalMigrated}`);
    console.log(`Échecs   : ${totalFailed}`);

    await pool.end();
}

main().catch((err) => {
    console.error('Erreur fatale :', err);
    process.exit(1);
});
