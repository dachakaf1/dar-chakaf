// ================================================================
// LOGO-SYNC.JS — Applique le logo enregistré dans les Paramètres
// du site (site_settings.logo) sur toutes les pages publiques et
// admin, sans avoir besoin de modifier le HTML à chaque changement.
// Le logo par défaut (/assets/logo/dar-chakaf-logo.svg) reste affiché
// tant que l'API n'a pas répondu ou si aucun logo n'est enregistré.
// ================================================================
(function () {
    var DEFAULT_LOGO = '/assets/logo/dar-chakaf-logo.svg';

    function applyLogo(url) {
        if (!url || url.trim() === '' || url.trim() === DEFAULT_LOGO) return;
        var value = url.trim();

        // On précharge le logo personnalisé dans une image invisible d'abord.
        // Si l'URL/base64 est corrompue ou ne charge pas, on ne touche à rien :
        // le logo par défaut (déjà affiché correctement) reste en place au lieu
        // de faire échouer les <img> visibles et déclencher le fallback "D".
        var probe = new Image();
        probe.onload = function () {
            document.querySelectorAll('img[src="' + DEFAULT_LOGO + '"]').forEach(function (img) {
                img.src = value;
            });

            var icon = document.querySelector('link[rel="icon"]');
            if (icon) icon.href = value;

            var touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
            if (touchIcon) touchIcon.href = value;
        };
        probe.onerror = function () {
            // Logo personnalisé invalide/corrompu : on garde le logo par défaut,
            // pas de changement visible, pas de fallback "D".
        };
        probe.src = value;
    }

    fetch('/api/parametres')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res && res.success && res.data && res.data.logo) {
                applyLogo(res.data.logo);
            }
        })
        .catch(function () {
            // En cas d'erreur réseau, on garde le logo par défaut déjà affiché.
        });
})();
