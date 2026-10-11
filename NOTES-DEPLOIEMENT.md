# Dar Chakaf — Notes de déploiement (SEO & Marketing + nouvelles fonctionnalités)

## 1. Base de données — IMPORTANT, à faire en premier
Exécuter le fichier `db/migration_new_features.sql` sur votre base PostgreSQL
(Neon / Vercel Postgres) avant de déployer le code. Il crée les tables
`devis_requests`, `newsletter_subscribers`, `blog_articles`, ajoute des
colonnes `photos` (avis), `titre_ar`/`description_ar`/`meta_description`
(produits), `nom_ar` (catégories), et `ga_measurement_id`/`tawkto_widget_id`
(site_settings). Toutes les instructions utilisent `IF NOT EXISTS`, donc
sans risque de la relancer.

## 2. Ce qui a été ajouté

### SEO & Marketing
- Balises Open Graph, Twitter Card et `<link rel="canonical">` sur les 18 pages publiques
- JSON-LD : `FurnitureStore` (accueil), `Product` (fiche produit, généré dynamiquement),
  `Article` (articles de blog)
- `robots.txt` + `/sitemap.xml` généré dynamiquement (inclut catégories, produits actifs, articles publiés)
- Google Analytics 4 et chat en direct (Tawk.to) : **à activer depuis Admin > Paramètres**,
  rien n'est chargé tant que les identifiants ne sont pas renseignés (aucun code en dur)

### Favoris / Wishlist
- Bouton cœur sur chaque carte produit + fiche produit (localStorage, sans compte)
- Page dédiée `/favoris.html`

### Comparateur
- Bouton balance sur chaque carte produit + fiche produit (jusqu'à 3 produits)
- Barre flottante en bas de page + page dédiée `/comparateur.html`

### Demande de devis multi-produits
- Bouton "Ajouter au devis" sur les cartes et fiches produit
- Page `/devis.html` (panier + formulaire) → stocké en base (`devis_requests`)
- Gestion depuis **Admin > Demandes de devis**

### Newsletter
- Formulaire dans le pied de page de toutes les pages → `newsletter_subscribers`
- Gestion + export CSV depuis **Admin > Newsletter**

### Filtres avancés
- Sur les pages de collection (`produits/categorie.html`) : prix, matériau, coloris, tri

### Blog / Actualités
- `/blog.html` (liste) + `/blog-article.html?slug=...` (article)
- Gestion (créer/modifier/publier) depuis **Admin > Blog**

### Avis clients avec photos
- L'API `/api/avis` accepte désormais jusqu'à 4 photos par avis (uploadées vers Vercel Blob)

### Multi-langue FR / AR
- Sélecteur FR/AR dans le header de toutes les pages, bascule le layout en RTL
- Traduit automatiquement : navigation, pied de page, libellés génériques
  (`public/assets/i18n/translations.json`)
- **Limite à connaître** : le contenu métier (descriptions produits, texte des
  pages, articles de blog) n'est PAS traduit automatiquement. Les colonnes
  `titre_ar` / `description_ar` (produits) et `nom_ar` (catégories) existent
  en base et dans l'API — il reste à les remplir depuis l'admin (formulaires
  à compléter) et à brancher `DCi18n.pick()` sur l'affichage des produits
  pour un site 100% bilingue.

### Live chat
- Widget Tawk.to en option, activable depuis Admin > Paramètres (voir ci-dessus)

## 3. Ce qui n'a PAS été fait dans cette passe
- **Correctifs de sécurité** (JWT secret, rate-limiting, headers `helmet`,
  CORS) : prochaine étape, comme convenu

## 4. Fichiers clés ajoutés
```
db/migration_new_features.sql
api/devis/index.js
api/newsletter/index.js
api/blog/index.js
admin/devis/liste.html
admin/newsletter/liste.html
admin/blog/liste.html
public/assets/js/site-features.js
public/assets/js/i18n.js
public/assets/css/site-features.css
public/assets/i18n/translations.json
favoris.html / comparateur.html / devis.html / blog.html / blog-article.html
robots.txt
```
