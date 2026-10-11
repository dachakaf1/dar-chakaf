/* ================================================================
   DAR CHAKAF — i18n (FR / AR)
   Traduit le "chrome" du site (nav, footer, libellés génériques) via
   des attributs data-i18n="cle" / data-i18n-placeholder="cle", et
   bascule le layout en RTL pour l'arabe. Persisté en localStorage.

   NOTE IMPORTANTE : ce module traduit l'interface (menus, boutons,
   pied de page). Il ne traduit PAS automatiquement le contenu métier
   (descriptions de produits, articles de blog, texte des pages) —
   ces champs ont des colonnes dédiées en base (titre_ar,
   description_ar, nom_ar) à remplir depuis l'admin, ou nécessitent
   une traduction de contenu dédiée pour les pages statiques.
   ================================================================ */
(function (global) {
    'use strict';

    var LS_LANG = 'dc_lang';
    var translations = null;

    function currentLang() {
        return localStorage.getItem(LS_LANG) || 'fr';
    }

    function loadTranslations() {
        if (translations) return Promise.resolve(translations);
        return fetch('/assets/i18n/translations.json')
            .then(function (r) { return r.json(); })
            .then(function (data) { translations = data; return data; })
            .catch(function () { return { fr: {}, ar: {} }; });
    }

    function t(key, lang) {
        lang = lang || currentLang();
        if (!translations) return key;
        return (translations[lang] && translations[lang][key]) || (translations.fr && translations.fr[key]) || key;
    }

    function applyLang(lang) {
        document.documentElement.setAttribute('lang', lang === 'ar' ? 'ar' : 'fr');
        document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        document.body.classList.toggle('dc-rtl', lang === 'ar');

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'), lang);
        });
        // Variante HTML : pour un texte qui contient du balisage interne
        // (ex. <em>, <br>) qu'on doit garder — data-i18n écraserait ce
        // balisage via textContent, donc on utilise innerHTML ici à la place.
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            el.innerHTML = t(el.getAttribute('data-i18n-html'), lang);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), lang));
        });

        document.querySelectorAll('.dc-lang-switch').forEach(function (btn) {
            btn.querySelectorAll('span').forEach(function (s) {
                s.classList.toggle('active', s.dataset.lang === lang);
            });
        });
    }

    function setLang(lang) {
        localStorage.setItem(LS_LANG, lang);
        loadTranslations().then(function () { applyLang(lang); });
    }

    function mountSwitcher() {
        document.querySelectorAll('.dc-lang-switch-mount').forEach(function (mount) {
            if (mount.dataset.dcMounted) return;
            mount.dataset.dcMounted = '1';
            var sw = document.createElement('div');
            sw.className = 'dc-lang-switch';
            sw.innerHTML = '<span data-lang="fr">FR</span><span data-lang="ar">AR</span>';
            sw.querySelectorAll('span').forEach(function (s) {
                s.addEventListener('click', function () { setLang(s.dataset.lang); });
            });
            mount.appendChild(sw);
        });
    }

    // ============================================================
    // HELPER — pour le rendu dynamique de produits/catégories,
    // choisit le champ AR si la langue courante est 'ar' et qu'il
    // existe, sinon retombe sur le champ FR.
    // ============================================================
    function pick(obj, frField, arField) {
        if (!obj) return '';
        if (currentLang() === 'ar' && obj[arField]) return obj[arField];
        return obj[frField] || '';
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadTranslations().then(function () {
            applyLang(currentLang());
            mountSwitcher();
        });
    });

    global.DCi18n = {
        t: t,
        setLang: setLang,
        currentLang: currentLang,
        pick: pick,
        mountSwitcher: mountSwitcher
    };
})(window);
