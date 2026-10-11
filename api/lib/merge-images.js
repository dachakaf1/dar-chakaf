// ============================================================
// GARDE-FOU : ne jamais perdre une photo saisie dans l'admin.
//
// Le formulaire produit a DEUX endroits pour mettre une photo :
//   1) le champ "Image principale" (colonne produits.image_principale)
//   2) la "Galerie photos" (table `images`, liée par produit_id)
//
// Toutes les pages publiques (accueil, catégories, fiche produit)
// affichent `p.images` (la galerie) et ignorent `image_principale`
// dès que la galerie n'est pas vide. Résultat concret : un admin qui
// colle un lien dans "Image principale" sans l'ajouter aussi à la
// galerie voit sa photo dans le formulaire d'admin... mais elle
// n'apparaît JAMAIS côté client si ce produit a par ailleurs des
// photos de galerie.
//
// Cette fonction fusionne les deux sources avant de répondre à
// l'API : `image_principale` est replacée en tête de la liste
// `images` si elle n'y est pas déjà. Aucune photo saisie dans
// l'admin ne peut plus "disparaître" côté public.
// ============================================================

function mergeMainImage(product) {
    if (!product) return product;
    const gallery = Array.isArray(product.images) ? product.images : [];
    if (product.image_principale && !gallery.includes(product.image_principale)) {
        product.images = [product.image_principale, ...gallery];
    }
    return product;
}

function mergeMainImageMany(products) {
    if (!Array.isArray(products)) return products;
    products.forEach(mergeMainImage);
    return products;
}

module.exports = { mergeMainImage, mergeMainImageMany };
