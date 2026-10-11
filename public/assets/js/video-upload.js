/**
 * DarChakafVideoUpload
 * ============================================================
 * Envoie un fichier vidéo directement du navigateur vers Vercel Blob
 * (sans jamais passer par notre serveur — les vidéos sont trop lourdes
 * pour la limite de 4.5 Mo par requête imposée par Vercel).
 *
 * Utilisation (depuis une page admin, avec le token JWT admin) :
 *
 *   DarChakafVideoUpload.uploadVideo(file, adminToken, function(pct){ ... })
 *     .then(function(url) { ... url Vercel Blob de la vidéo ... })
 *     .catch(function(err) { ... });
 */
(function (global) {
    'use strict';

    var BLOB_CLIENT_URLS = [
        'https://esm.sh/@vercel/blob@0.27.0/client',
        'https://cdn.jsdelivr.net/npm/@vercel/blob@0.27.0/+esm'
    ];
    var MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 Go — doit matcher upload-token.js
    var ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
    var ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.ogg', '.ogv', '.m4v', '.avi', '.3gp'];

    // Au-delà de cette taille, on envoie la vidéo en plusieurs morceaux
    // (upload "multipart") plutôt qu'en une seule requête. C'est plus
    // fiable sur un réseau instable (chaque morceau est réessayé
    // individuellement en cas de coupure) et ça donne une progression
    // plus régulière. On a observé des blocages complets sur Safari iOS
    // même en upload simple (non-multipart) et même en Wi-Fi — un envoi
    // en morceaux, chacun étant une requête plus petite et indépendante,
    // a plus de chances de passer que UNE seule très grosse requête.
    var MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 Mo (minimum imposé par Vercel pour un morceau)

    // Si la progression ne bouge plus du tout pendant ce délai, on
    // considère que l'upload est bloqué et on abandonne avec un message
    // clair plutôt que de laisser l'utilisateur fixer un "0%" indéfiniment.
    // ATTENTION : ce délai ne s'applique QUE sur les navigateurs qui
    // savent réellement remonter une progression (voir plus bas) — sur
    // Safari/iOS, on utilise une autre logique (voir SAFARI_MAX_DURATION_MS).
    var STALL_TIMEOUT_MS = 30000;

    // ------------------------------------------------------------------
    // Cas particulier Safari / WebKit (donc TOUT navigateur sur iPhone et
    // iPad, y compris Chrome iOS, Safari inclus sur Mac) :
    //
    // WebKit ne sait pas faire remonter d'événements de progression pour
    // l'envoi (upload) d'un fetch() — seule la réception (download) est
    // supportée. @vercel/blob simule cette progression en lisant le
    // fichier via un ReadableStream pendant l'envoi, ce que WebKit ne
    // supporte pas non plus pour le corps d'une requête sortante. Résultat
    // : sur Safari/iOS, onUploadProgress ne se déclenche JAMAIS, même
    // quand l'envoi se passe parfaitement — ce n'est PAS un blocage réel.
    //
    // Notre ancien code interprétait ce silence comme "upload bloqué" et
    // ANNULAIT (AbortController) un envoi qui était en réalité en train de
    // réussir, au bout de 30 secondes — exactement le bug observé
    // ("reste à 0%, puis erreur bloqué") alors que Windows/Android (où le
    // navigateur sait remonter la progression) fonctionnaient normalement.
    //
    // Pour ces navigateurs, on n'annule donc PAS en l'absence de
    // progression : on laisse l'envoi suivre son cours jusqu'à une limite
    // large calculée sur la taille du fichier (débit minimum supposé de
    // 150 Ko/s), et l'interface affiche "Envoi en cours…" plutôt qu'un
    // pourcentage qui ne bougera jamais.
    function isLikelyWebKitNoUploadProgress() {
        try {
            var ua = navigator.userAgent || '';
            var isIOSDevice = /iP(hone|od|ad)/.test(ua) ||
                // iPadOS 13+ se présente comme un Mac, mais garde le tactile.
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            var isSafariBrowser = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
            return isIOSDevice || isSafariBrowser;
        } catch (e) {
            return false;
        }
    }

    function computeSafariMaxDurationMs(fileSize) {
        var ASSUMED_MIN_BYTES_PER_SEC = 150 * 1024; // hypothèse basse (4G lente)
        var estimated = (fileSize / ASSUMED_MIN_BYTES_PER_SEC) * 1000;
        var MIN_MS = 2 * 60 * 1000;   // au moins 2 min
        // Les vidéos pouvant désormais aller jusqu'à 2 Go, ce plafond est
        // relevé en conséquence (avant : 20 min, trop court pour un gros
        // fichier envoyé en 4G lente — l'envoi était alors annulé à tort
        // alors qu'il progressait toujours normalement).
        var MAX_MS = 3 * 60 * 60 * 1000; // jamais plus de 3h
        return Math.max(MIN_MS, Math.min(MAX_MS, estimated));
    }

    function isAcceptedVideo(file) {
        // Certains navigateurs mobiles (notamment Safari sur iPhone) ne
        // renvoient pas toujours un type MIME identique à notre liste
        // stricte, ou renvoient une chaîne vide selon la façon dont la
        // vidéo a été choisie (Photos, Fichiers, etc.). On accepte donc
        // tout type commençant par "video/", et en dernier recours on
        // se base sur l'extension du fichier.
        if (file.type && file.type.indexOf('video/') === 0) return true;
        var name = (file.name || '').toLowerCase();
        return ACCEPTED_EXTENSIONS.some(function (ext) { return name.indexOf(ext, name.length - ext.length) !== -1; });
    }

    function withTimeout(promise, ms, message) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error(message)); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                         function (e) { clearTimeout(timer); reject(e); });
        });
    }

    var blobClientPromise = null;
    function loadBlobClient() {
        if (blobClientPromise) return blobClientPromise;

        // On essaie chaque CDN l'un après l'autre (certains réseaux/appareils
        // bloquent ou mettent longtemps à répondre sur l'un d'entre eux —
        // notamment observé sur iPad/iPhone selon le réseau Wi-Fi utilisé).
        var attempt = function (index) {
            if (index >= BLOB_CLIENT_URLS.length) {
                return Promise.reject(new Error("Impossible de charger le module d'upload (vérifiez votre connexion internet)."));
            }
            var url = BLOB_CLIENT_URLS[index];
            return withTimeout(
                import(/* webpackIgnore: true */ url),
                12000,
                'Chargement du module trop long (' + url + ')'
            ).catch(function () {
                return attempt(index + 1);
            });
        };

        blobClientPromise = attempt(0);
        return blobClientPromise;
    }

    function safeFilename(name) {
        return String(name || 'video').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    }

    // Envoie le fichier vers Vercel Blob en surveillant l'activité : si
    // aucune progression n'arrive pendant STALL_TIMEOUT_MS, on annule la
    // requête (AbortController) et on rejette avec un message actionnable,
    // au lieu de laisser l'appel pendre indéfiniment (le cas "reste à 0%"
    // observé sur iPhone/iPad).
    function putWithStallGuard(mod, pathname, file, clientToken, contentType, useMultipart, onProgress) {
        return new Promise(function (resolve, reject) {
            var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            var settled = false;
            var stallTimer = null;
            var sawRealProgress = false;

            // Safari/iOS ne remontent jamais onUploadProgress (voir notes
            // plus haut) : on ne peut donc pas se baser sur "pas de
            // progression depuis N secondes" pour détecter un blocage sans
            // interrompre à tort des envois qui se déroulent normalement.
            //
            // Ce test UA est une optimisation (on saute direct au mode
            // "pas de progression attendue" quand on est déjà sûr), mais
            // ce n'est PAS la seule protection : certains appareils/iPad
            // en "Safari de bureau" ou dans un webview se présentent avec
            // un user-agent qu'on ne reconnaît pas ici, alors même que le
            // comportement (aucune progression alors que l'envoi se passe
            // bien) est identique. On a observé ce cas en conditions
            // réelles : le test UA disait "non", et un upload qui
            // fonctionnait normalement se faisait quand même annuler à
            // 30 secondes. D'où le filet de sécurité "escalatedToLongMode"
            // plus bas, qui ne dépend PAS de la détection UA.
            var noProgressExpected = isLikelyWebKitNoUploadProgress();
            var escalatedToLongMode = false;

            function abortWithLongTimeout() {
                // Filet de sécurité final, basé sur la taille du fichier :
                // à ce stade on a déjà laissé largement le temps à un envoi
                // normal de montrer une progression, donc si RIEN n'est
                // arrivé (ni progression, ni succès, ni échec réseau) dans
                // ce délai très large, on abandonne pour de vrai.
                stallTimer = setTimeout(function () {
                    if (settled) return;
                    settled = true;
                    if (controller) { try { controller.abort(); } catch (e) {} }
                    reject(new Error(
                        "L'envoi prend anormalement longtemps et a été interrompu. " +
                        'Vérifiez votre connexion (Wi-Fi conseillé) et réessayez.'
                    ));
                }, computeSafariMaxDurationMs(file.size));
            }

            function armStallTimer() {
                if (stallTimer) clearTimeout(stallTimer);
                stallTimer = setTimeout(function () {
                    if (settled) return;
                    // Avant d'annuler franchement, on considère la
                    // possibilité qu'on soit face à un navigateur qui, en
                    // réalité, ne remonte simplement jamais de progression
                    // (comme WebKit/iOS) mais que notre détection UA
                    // n'a pas reconnu comme tel. Dans ce cas précis —
                    // aucune progression du tout depuis le début, pas
                    // seulement une pause — on bascule une seule fois vers
                    // le mode "grand délai" au lieu d'annuler un envoi qui
                    // est peut-être simplement en train de réussir en
                    // silence.
                    if (!sawRealProgress && !escalatedToLongMode) {
                        escalatedToLongMode = true;
                        abortWithLongTimeout();
                        return;
                    }
                    settled = true;
                    if (controller) { try { controller.abort(); } catch (e) {} }
                    reject(new Error(
                        "L'upload semble bloqué (aucune progression depuis 30 secondes). " +
                        "Vérifiez votre connexion et réessayez. Sur iPhone/iPad : essayez de choisir " +
                        "la vidéo depuis l'app \u00abFichiers\u00bb plutôt que \u00abPhotos\u00bb, " +
                        'ou passez sur le Wi-Fi si vous êtes en 4G/5G.'
                    ));
                }, STALL_TIMEOUT_MS);
            }

            if (noProgressExpected) {
                abortWithLongTimeout();
            } else {
                armStallTimer();
            }

            var putOptions = {
                access: 'public',
                token: clientToken,
                contentType: contentType,
                multipart: useMultipart
            };
            // IMPORTANT (cause probable du blocage réel — pas seulement
            // un problème d'affichage — observé UNIQUEMENT sur iPhone/
            // iPad) : pour remonter une progression, @vercel/blob doit
            // envelopper le corps de la requête dans un ReadableStream
            // (afin de compter les octets envoyés au fur et à mesure).
            // Or Safari/WebKit ne supporte pas — ou très mal — l'envoi
            // d'un corps de requête en streaming via fetch() : au lieu
            // d'échouer proprement, l'envoi peut rester bloqué
            // indéfiniment, sans jamais réussir ni renvoyer d'erreur.
            // C'est exactement le symptôme observé ("reste sur 'Envoi en
            // cours…' et n'avance plus jamais", uniquement sur appareils
            // Apple). Sur ces navigateurs, on ne demande donc PAS de
            // suivi de progression : le fichier est alors envoyé tel
            // quel (Blob/File natif, sans passer par un ReadableStream),
            // ce que Safari sait faire correctement. On perd
            // l'affichage en %, mais l'envoi aboutit réellement — et
            // l'indicateur "Envoi en cours…" (voir les pages qui
            // utilisent cette fonction) reste affiché pendant ce temps.
            if (!noProgressExpected) {
                putOptions.onUploadProgress = function (event) {
                    if (!escalatedToLongMode) {
                        armStallTimer(); // toute activité repousse le délai de blocage
                    }
                    if (typeof onProgress === 'function' && event && typeof event.percentage === 'number') {
                        sawRealProgress = true;
                        onProgress(event.percentage);
                    }
                };
            }
            if (controller) putOptions.abortSignal = controller.signal;

            mod.put(pathname, file, putOptions).then(
                function (blob) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(stallTimer);
                    resolve(blob);
                },
                function (err) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(stallTimer);
                    reject(err);
                }
            );
        });
    }

    // Capture une image (JPEG en data URL) depuis les premières images de la
    // vidéo, DANS LE NAVIGATEUR QUI UPLOAD (donc capable de décoder son
    // propre fichier, y compris le HEVC/H.265 typique des iPhone). Cette
    // image sert de vraie miniature sur la fiche produit, indépendamment du
    // fait que le navigateur du visiteur sache ou non décoder la vidéo.
    // Ne bloque jamais l'upload : en cas d'échec ou de délai dépassé, on
    // résout simplement avec `null` (pas de miniature — c'est le cadre
    // noir vide observé sur les fiches produit, uniquement quand cette
    // capture a échoué).
    //
    // ATTENTION (bug observé en conditions réelles sur iPhone/iPad) :
    // Safari/WebKit ne décode PAS de façon fiable un <video> qui n'est ni
    // attaché au DOM, ni jamais lancé en lecture — les événements
    // "loadeddata"/"seeked" pouvaient tout simplement ne jamais se
    // déclencher, et on retombait sur `null` (donc le cadre vide) alors
    // que la vidéo elle-même s'uploadait très bien. Le correctif : on
    // attache l'élément (hors écran, invisible, mais bien dans le DOM),
    // on force `preload="auto"` pour de vraies données décodées (pas
    // seulement les métadonnées), et on déclenche un `play()`/`pause()`
    // muet — ce qui amorce le pipeline de décodage sur WebKit — avant de
    // chercher l'image à capturer.
    function capturePosterFrame(file) {
        return new Promise(function (resolve) {
            if (!file || !isAcceptedVideo(file) || typeof document === 'undefined') {
                resolve(null);
                return;
            }
            try {
                var videoEl = document.createElement('video');
                videoEl.muted = true;
                videoEl.defaultMuted = true;
                videoEl.playsInline = true;
                videoEl.setAttribute('playsinline', ''); // ancien Safari iOS : attribut HTML, pas juste la propriété JS
                videoEl.preload = 'auto';
                // Hors écran mais bien DANS le DOM (pas display:none, qui
                // désactive le décodage vidéo sur certains WebKit) : c'est
                // ce qui manquait pour un décodage fiable sur iPhone/iPad.
                videoEl.style.cssText = 'position:fixed; left:-9999px; top:-9999px; width:1px; height:1px; opacity:0;';
                document.body.appendChild(videoEl);

                var objectUrl = URL.createObjectURL(file);
                var settled = false;
                var capturedOnce = false;

                // Délai plus large que sur ordinateur : un iPhone plus
                // ancien, ou sous pression mémoire, peut être nettement
                // plus lent à décoder un fichier HEVC volumineux.
                var safety = setTimeout(function () { finish(null); }, 15000);

                function cleanup() {
                    clearTimeout(safety);
                    try { URL.revokeObjectURL(objectUrl); } catch (e) {}
                    try { videoEl.pause(); } catch (e) {}
                    try { videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {}
                    try { if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl); } catch (e) {}
                }
                function finish(dataUrl) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(dataUrl || null);
                }
                function captureNow() {
                    if (capturedOnce) return; // évite un double appel (loadeddata + seeked peuvent se chevaucher)
                    capturedOnce = true;
                    try {
                        var canvas = document.createElement('canvas');
                        canvas.width = videoEl.videoWidth || 640;
                        canvas.height = videoEl.videoHeight || 360;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                        finish(canvas.toDataURL('image/jpeg', 0.82));
                    } catch (e) {
                        // Vidéo non décodable par ce navigateur, ou canvas
                        // "tainted" : pas grave, on continue sans miniature.
                        finish(null);
                    }
                }
                function seekToTarget() {
                    try {
                        // Une image légèrement après 0 évite les premières
                        // images noires/transparentes de certains fichiers.
                        var target = Math.min(0.2, (videoEl.duration || 1) / 2);
                        videoEl.currentTime = target;
                    } catch (e) {
                        captureNow();
                    }
                }

                videoEl.addEventListener('loadeddata', function onLoaded() {
                    videoEl.removeEventListener('loadeddata', onLoaded);
                    // Amorce le pipeline de décodage WebKit : sur iPhone/
                    // iPad, chercher (seek) une image sans être passé par
                    // un play()/pause() préalable échouait silencieusement
                    // (canvas resté noir ou événements jamais déclenchés).
                    var playPromise = videoEl.play();
                    if (playPromise && typeof playPromise.then === 'function') {
                        playPromise.then(function () {
                            try { videoEl.pause(); } catch (e) {}
                            seekToTarget();
                        }, function () {
                            // Lecture refusée par le navigateur : on tente
                            // quand même la recherche directe.
                            seekToTarget();
                        });
                    } else {
                        seekToTarget();
                    }
                });
                videoEl.addEventListener('seeked', captureNow);
                // Filet de sécurité supplémentaire : si "seeked" ne se
                // déclenche jamais (encore un cas WebKit observé) mais que
                // l'image affichée a effectivement changé, on capture
                // quand même après un court délai suivant "loadeddata".
                videoEl.addEventListener('loadeddata', function () {
                    setTimeout(function () { if (!capturedOnce) captureNow(); }, 1200);
                });
                videoEl.addEventListener('error', function () { finish(null); });
                videoEl.src = objectUrl;
                videoEl.load();
            } catch (e) {
                resolve(null);
            }
        });
    }

    function getClientToken(pathname, adminToken, multipart) {
        return withTimeout(
            fetch('/api/videos/upload-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + adminToken
                },
                body: JSON.stringify({
                    type: 'blob.generate-client-token',
                    payload: {
                        pathname: pathname,
                        callbackUrl: window.location.origin + '/api/videos/upload-token',
                        multipart: !!multipart,
                        clientPayload: null
                    }
                })
            }),
            15000,
            "Le serveur ne répond pas (jeton d'upload)."
        ).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok || !data || !data.clientToken) {
                    throw new Error((data && data.message) || "Impossible d'obtenir l'autorisation d'upload.");
                }
                return data.clientToken;
            });
        });
    }

    function uploadVideo(file, adminToken, onProgress, onStage) {
        if (!file) return Promise.reject(new Error('Aucun fichier fourni.'));
        if (!isAcceptedVideo(file)) {
            return Promise.reject(new Error('Format vidéo non supporté. Utilisez MP4, MOV, WebM ou MKV.'));
        }
        if (file.size > MAX_VIDEO_SIZE) {
            return Promise.reject(new Error('Vidéo trop volumineuse (max 2 Go).'));
        }

        function stage(s) {
            if (typeof onStage === 'function') onStage(s);
        }

        var resolvedContentType = file.type || 'video/mp4';
        var useMultipart = file.size > MULTIPART_THRESHOLD;

        var pathname = 'videos/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeFilename(file.name);

        stage('preparation');
        return Promise.all([loadBlobClient(), getClientToken(pathname, adminToken, useMultipart)])
            .then(function (results) {
                var mod = results[0];
                var clientToken = results[1];
                stage('envoi');
                return putWithStallGuard(mod, pathname, file, clientToken, resolvedContentType, useMultipart, onProgress);
            })
            .then(function (blob) {
                stage('termine');
                return blob.url;
            });
    }

    // Enregistre l'URL déjà uploadée en base (table `videos`).
    function saveVideoRecord(url, options, adminToken) {
        options = options || {};
        return fetch('/api/videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + adminToken
            },
            body: JSON.stringify({
                url: url,
                produitId: options.produitId || null,
                titre: options.titre || null,
                description: options.description || null,
                posterUrl: options.posterUrl || null
            })
        }).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok || !data.success) {
                    throw new Error((data && data.message) || "Erreur lors de l'enregistrement de la vidéo.");
                }
                return data.data;
            });
        });
    }

    global.DarChakafVideoUpload = {
        uploadVideo: uploadVideo,
        saveVideoRecord: saveVideoRecord,
        capturePosterFrame: capturePosterFrame,
        ACCEPTED_TYPES: ACCEPTED_TYPES,
        MAX_VIDEO_SIZE: MAX_VIDEO_SIZE
    };
})(window);
