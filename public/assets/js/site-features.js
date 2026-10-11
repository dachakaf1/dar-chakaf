/* ================================================================
   DAR CHAKAF — SITE FEATURES (wishlist, comparateur, devis, newsletter)
   Stocke tout en localStorage (pas de compte requis). Aucune dépendance.
   ================================================================ */
(function (global) {
    'use strict';

    var LS_WISHLIST = 'dc_wishlist';
    var LS_COMPARE = 'dc_compare';
    var LS_DEVIS = 'dc_devis_cart';
    var MAX_COMPARE = 3;

    // Numéro WhatsApp du site — mis à jour dès que /api/parametres répond
    // (voir loadAnalyticsAndChat). Valeur de secours en attendant.
    var siteWhatsappNumber = '212600000000';

    function readList(key) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function writeList(key, list) {
        try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    }

    // ============================================================
    // WISHLIST
    // ============================================================
    var Wishlist = {
        getAll: function () { return readList(LS_WISHLIST); },
        has: function (id) { return Wishlist.getAll().some(function (p) { return String(p.id) === String(id); }); },
        toggle: function (product) {
            var list = Wishlist.getAll();
            var idx = list.findIndex(function (p) { return String(p.id) === String(product.id); });
            if (idx >= 0) {
                list.splice(idx, 1);
                writeList(LS_WISHLIST, list);
                DCFeatures.emit('wishlist:change', list);
                return false;
            }
            list.push(product);
            writeList(LS_WISHLIST, list);
            DCFeatures.emit('wishlist:change', list);
            return true;
        },
        remove: function (id) {
            var list = Wishlist.getAll().filter(function (p) { return String(p.id) !== String(id); });
            writeList(LS_WISHLIST, list);
            DCFeatures.emit('wishlist:change', list);
        },
        count: function () { return Wishlist.getAll().length; }
    };

    // ============================================================
    // COMPARATEUR
    // ============================================================
    var Compare = {
        getAll: function () { return readList(LS_COMPARE); },
        has: function (id) { return Compare.getAll().some(function (p) { return String(p.id) === String(id); }); },
        toggle: function (product) {
            var list = Compare.getAll();
            var idx = list.findIndex(function (p) { return String(p.id) === String(product.id); });
            if (idx >= 0) {
                list.splice(idx, 1);
                writeList(LS_COMPARE, list);
                DCFeatures.emit('compare:change', list);
                return { added: false, list: list };
            }
            if (list.length >= MAX_COMPARE) {
                return { added: false, list: list, full: true };
            }
            list.push(product);
            writeList(LS_COMPARE, list);
            DCFeatures.emit('compare:change', list);
            return { added: true, list: list };
        },
        remove: function (id) {
            var list = Compare.getAll().filter(function (p) { return String(p.id) !== String(id); });
            writeList(LS_COMPARE, list);
            DCFeatures.emit('compare:change', list);
        },
        clear: function () { writeList(LS_COMPARE, []); DCFeatures.emit('compare:change', []); },
        count: function () { return Compare.getAll().length; },
        max: MAX_COMPARE
    };

    // ============================================================
    // DEVIS (panier de demande de devis)
    // ============================================================
    var DevisCart = {
        getAll: function () { return readList(LS_DEVIS); },
        has: function (id) { return DevisCart.getAll().some(function (p) { return String(p.id) === String(id); }); },
        add: function (product) {
            var list = DevisCart.getAll();
            var idx = list.findIndex(function (p) { return String(p.id) === String(product.id); });
            if (idx >= 0) {
                list[idx].quantite = (list[idx].quantite || 1) + 1;
            } else {
                product.quantite = 1;
                list.push(product);
            }
            writeList(LS_DEVIS, list);
            DCFeatures.emit('devis:change', list);
            return list;
        },
        remove: function (id) {
            var list = DevisCart.getAll().filter(function (p) { return String(p.id) !== String(id); });
            writeList(LS_DEVIS, list);
            DCFeatures.emit('devis:change', list);
        },
        setQuantity: function (id, qty) {
            var list = DevisCart.getAll();
            var item = list.find(function (p) { return String(p.id) === String(id); });
            if (item) { item.quantite = Math.max(1, qty); writeList(LS_DEVIS, list); DCFeatures.emit('devis:change', list); }
        },
        clear: function () { writeList(LS_DEVIS, []); DCFeatures.emit('devis:change', []); },
        count: function () { return DevisCart.getAll().reduce(function (n, p) { return n + (p.quantite || 1); }, 0); }
    };

    // ============================================================
    // EVENT BUS (simple)
    // ============================================================
    var listeners = {};
    function on(evt, fn) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
    }
    function emit(evt, data) {
        (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
        window.dispatchEvent(new CustomEvent('dc:' + evt, { detail: data }));
    }

    // ============================================================
    // NEWSLETTER
    // ============================================================
    function subscribeNewsletter(email) {
        return fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        }).then(function (r) { return r.json(); });
    }

    // ============================================================
    // FLOATING BADGES — met à jour tous les compteurs sur la page
    // (icônes header : wishlist-count, compare-count, devis-count)
    // ============================================================
    function refreshBadges() {
        document.querySelectorAll('[data-wishlist-count]').forEach(function (el) {
            var n = Wishlist.count();
            el.textContent = n;
            el.style.display = n > 0 ? '' : 'none';
        });
        document.querySelectorAll('[data-compare-count]').forEach(function (el) {
            var n = Compare.count();
            el.textContent = n;
            el.style.display = n > 0 ? '' : 'none';
        });
        document.querySelectorAll('[data-devis-count]').forEach(function (el) {
            var n = DevisCart.count();
            el.textContent = n;
            el.style.display = n > 0 ? '' : 'none';
        });
    }

    on('wishlist:change', refreshBadges);
    on('compare:change', refreshBadges);
    on('devis:change', refreshBadges);

    // ============================================================
    // INJECT WISHLIST/COMPARE BUTTONS ON PRODUCT CARDS
    // Appelle DCFeatures.enhanceCard(cardEl, product) après avoir
    // injecté un .product-card dans le DOM, pour lui ajouter les
    // boutons cœur / comparer déjà stylés (voir site-features.css).
    // ============================================================
    function enhanceCard(cardEl, product) {
        if (!cardEl || cardEl.querySelector('.dc-card-tools')) return;
        var imgWrap = cardEl.querySelector('.product-image');
        if (!imgWrap) return;

        var tools = document.createElement('div');
        tools.className = 'dc-card-tools';

        var heartBtn = document.createElement('button');
        heartBtn.type = 'button';
        heartBtn.className = 'dc-tool-btn dc-wishlist-btn' + (Wishlist.has(product.id) ? ' active' : '');
        heartBtn.setAttribute('aria-label', 'Ajouter aux favoris');
        heartBtn.innerHTML = '<i class="fa-' + (Wishlist.has(product.id) ? 'solid' : 'regular') + ' fa-heart"></i>';
        heartBtn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            var added = Wishlist.toggle(product);
            heartBtn.classList.toggle('active', added);
            heartBtn.querySelector('i').className = 'fa-' + (added ? 'solid' : 'regular') + ' fa-heart';
            DCFeatures.toast(added ? 'Ajouté aux favoris' : 'Retiré des favoris');
        });

        var compareBtn = document.createElement('button');
        compareBtn.type = 'button';
        compareBtn.className = 'dc-tool-btn dc-compare-btn' + (Compare.has(product.id) ? ' active' : '');
        compareBtn.setAttribute('aria-label', 'Comparer ce produit');
        compareBtn.innerHTML = '<i class="fa-solid fa-scale-balanced"></i>';
        compareBtn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            var result = Compare.toggle(product);
            if (result.full) {
                DCFeatures.toast('Maximum ' + MAX_COMPARE + ' produits à comparer', true);
                return;
            }
            compareBtn.classList.toggle('active', result.added);
            DCFeatures.toast(result.added ? 'Ajouté au comparateur' : 'Retiré du comparateur');
        });

        var waBtn = document.createElement('button');
        waBtn.type = 'button';
        waBtn.className = 'dc-tool-btn dc-whatsapp-btn';
        waBtn.setAttribute('aria-label', 'Demander un devis sur WhatsApp');
        waBtn.title = 'Demander un devis sur WhatsApp';
        waBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i>';
        waBtn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            sendWhatsappForProduct(product);
        });

        tools.appendChild(heartBtn);
        tools.appendChild(compareBtn);
        tools.appendChild(waBtn);
        imgWrap.appendChild(tools);
    }

    // ============================================================
    // WHATSAPP — envoi instantané d'une demande de devis pour un
    // produit précis, avec sa photo (lien direct) et sa fiche produit,
    // directement depuis le bouton WhatsApp posé sur chaque card.
    // ============================================================
    function buildWhatsappProductMessage(product) {
        var title = (product && product.titre) || 'ce produit';
        var priceTxt = (product && product.prix) ? (Number(product.prix).toLocaleString() + ' DH') : '';
        var link = window.location.origin + '/produit-detail.html?ref=' + (product && product.id);

        var msg = 'Bonjour, je suis intéressé(e) par « ' + title + ' »' + (priceTxt ? ' (' + priceTxt + ')' : '') + '.';
        // On n'ajoute le lien direct de la photo que si c'est une vraie URL
        // (pas une image base64 — beaucoup trop longue pour un message WhatsApp).
        if (product && product.image && /^https?:\/\//i.test(product.image)) {
            msg += '\nPhoto : ' + product.image;
        }
        msg += '\nFiche produit : ' + link;
        msg += '\nPouvez-vous me donner plus d\'informations ?';
        return msg;
    }

    function sendWhatsappForProduct(product) {
        var text = buildWhatsappProductMessage(product);
        window.open('https://wa.me/' + siteWhatsappNumber + '?text=' + encodeURIComponent(text), '_blank');
    }

    // ============================================================
    // TOAST (léger, réutilisable partout)
    // ============================================================
    var toastTimer = null;
    function toast(msg, isError) {
        var el = document.getElementById('dc-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dc-toast';
            el.className = 'dc-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
    }

    // ============================================================
    // FOOTER NEWSLETTER FORM — cherche [data-newsletter-form] et
    // câble automatiquement le submit vers l'API.
    // ============================================================
    function wireNewsletterForms() {
        document.querySelectorAll('[data-newsletter-form]').forEach(function (form) {
            if (form.dataset.dcWired) return;
            form.dataset.dcWired = '1';
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var input = form.querySelector('input[type="email"]');
                if (!input || !input.value) return;
                var btn = form.querySelector('button[type="submit"]');
                var originalHtml = btn ? btn.innerHTML : '';
                if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
                subscribeNewsletter(input.value.trim()).then(function (res) {
                    if (res.success) {
                        toast('Merci ! Vous êtes inscrit(e) à la newsletter.');
                        input.value = '';
                    } else {
                        toast(res.message || 'Erreur, réessayez.', true);
                    }
                }).catch(function () {
                    toast('Erreur réseau, réessayez.', true);
                }).finally(function () {
                    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
                });
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        refreshBadges();
        wireNewsletterForms();
        mountCompareBar();
        loadAnalyticsAndChat();
    });

    // ============================================================
    // ANALYTICS (GA4) + LIVE CHAT (Tawk.to) — chargés dynamiquement
    // seulement si configurés dans Admin > Paramètres (pas de code
    // en dur, rien ne se charge tant que l'admin n'a pas renseigné
    // ses identifiants).
    // ============================================================
    function loadAnalyticsAndChat() {
        fetch('/api/parametres').then(function (r) { return r.json(); }).then(function (res) {
            if (!res || !res.success || !res.data) return;
            var info = res.data;

            if (info.whatsapp) {
                var waDigits = info.whatsapp.replace(/[^0-9]/g, '');
                if (waDigits.charAt(0) === '0') waDigits = '212' + waDigits.substring(1);
                if (waDigits) siteWhatsappNumber = waDigits;
            }

            if (info.ga_measurement_id) {
                var s1 = document.createElement('script');
                s1.async = true;
                s1.src = 'https://www.googletagmanager.com/gtag/js?id=' + info.ga_measurement_id;
                document.head.appendChild(s1);
                window.dataLayer = window.dataLayer || [];
                function gtag() { window.dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', info.ga_measurement_id);
                window.gtag = gtag;
            }

            if (info.tawkto_widget_id) {
                var s2 = document.createElement('script');
                s2.async = true;
                s2.src = 'https://embed.tawk.to/' + info.tawkto_widget_id;
                s2.setAttribute('crossorigin', '*');
                document.body.appendChild(s2);
            }
        }).catch(function () {});
    }

    // ============================================================
    // FLOATING COMPARE BAR — auto-injecté en bas de page si des
    // produits sont sélectionnés pour comparaison (sauf sur
    // comparateur.html lui-même, qui a sa propre UI).
    // ============================================================
    function mountCompareBar() {
        if (/comparateur\.html/.test(window.location.pathname)) return;

        var bar = document.getElementById('dc-compare-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'dc-compare-bar';
            bar.className = 'dc-compare-bar';
            bar.innerHTML =
                '<div class="dc-compare-items" id="dc-compare-items"></div>' +
                '<div style="display:flex;gap:10px;align-items:center;">' +
                '<a href="/comparateur.html" class="btn btn-gold btn-sm">Comparer <span data-compare-count style="margin-left:4px;"></span></a>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="dc-compare-clear">Effacer</button>' +
                '</div>';
            document.body.appendChild(bar);
            bar.querySelector('#dc-compare-clear').addEventListener('click', function () {
                Compare.clear();
            });
        }

        function render() {
            var list = Compare.getAll();
            bar.classList.toggle('show', list.length > 0);
            var itemsEl = bar.querySelector('#dc-compare-items');
            itemsEl.innerHTML = list.map(function (p) {
                return '<div class="dc-compare-thumb">' +
                    (p.image ? '<img src="' + p.image + '" alt="' + (p.titre || '') + '">' : '') +
                    '<span class="remove" data-id="' + p.id + '">×</span></div>';
            }).join('');
            itemsEl.querySelectorAll('.remove').forEach(function (el) {
                el.addEventListener('click', function () { Compare.remove(el.dataset.id); });
            });
            refreshBadges();
        }

        on('compare:change', render);
        render();
    }

    global.DCFeatures = {
        Wishlist: Wishlist,
        Compare: Compare,
        DevisCart: DevisCart,
        on: on,
        emit: emit,
        toast: toast,
        enhanceCard: enhanceCard,
        sendWhatsappForProduct: sendWhatsappForProduct,
        refreshBadges: refreshBadges,
        subscribeNewsletter: subscribeNewsletter,
        wireNewsletterForms: wireNewsletterForms
    };
})(window);
