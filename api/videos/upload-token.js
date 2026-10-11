const { handleUpload } = require('@vercel/blob/client');
const { requireAuth } = require('../lib/middleware-auth');
const { applyCors } = require('../lib/cors');

// ============================================================
// POURQUOI CE FICHIER EXISTE (contrairement aux images) :
//
// Les photos sont envoyées en base64 dans le même JSON que le
// produit (voir blob-upload.js) car, une fois compressées côté
// navigateur, elles pèsent ~150-400 Ko — largement sous la limite
// de 4.5 Mo que Vercel impose à toute requête de Serverless Function.
//
// Une vidéo, même courte, dépasse presque toujours 4.5 Mo. On ne peut
// donc pas la faire transiter par notre serveur. La solution officielle
// de Vercel est l'upload "client direct" : le navigateur envoie le
// fichier directement à Vercel Blob, sans jamais passer par notre API —
// notre serveur se contente de délivrer un jeton d'autorisation de courte
// durée (cette route), après avoir vérifié que la personne est bien un
// admin connecté.
//
// Une fois l'upload terminé, le navigateur récupère l'URL du fichier et
// l'envoie à /api/videos (POST) pour l'enregistrer en base — exactement
// comme pour un lien d'image externe déjà en ligne.
// ============================================================

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
    }

    try {
        // Cette route reçoit en réalité 2 appels différents, qui partagent
        // la même URL (callbackUrl) :
        //   1) Le navigateur admin demande un jeton d'upload
        //      (type "blob.generate-client-token") -> on exige bien une
        //      session admin valide ici.
        //   2) Vercel Blob confirme, de SERVEUR À SERVEUR, la fin de
        //      l'upload (type "blob.upload-completed") -> cet appel ne
        //      vient jamais du navigateur et ne contient donc jamais notre
        //      en-tête Authorization ; handleUpload() vérifie déjà son
        //      authenticité via sa propre signature interne. Appeler
        //      requireAuth() sans distinction bloquait systématiquement ce
        //      2e appel (401 "Non autorisé" côté serveur à chaque upload).
        const isClientTokenRequest = req.body && req.body.type === 'blob.generate-client-token';
        if (isClientTokenRequest) {
            requireAuth(req);
        }

        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
                return {
                    allowedContentTypes: ['video/*'],
                    addRandomSuffix: true,
                    maximumSizeInBytes: 2 * 1024 * 1024 * 1024, // 2 Go max par vidéo
                    // IMPORTANT : le jeton signé doit autoriser le même mode
                    // (multipart ou non) que celui utilisé plus tard par le
                    // navigateur pour l'envoi réel, sinon Vercel Blob rejette
                    // la requête. `multipart` ici vient directement de la
                    // demande du navigateur (voir video-upload.js).
                    multipart: !!multipart
                };
            },
            // On n'a pas besoin de ce webhook : dès que l'upload direct
            // se termine côté navigateur, celui-ci appelle lui-même
            // POST /api/videos avec l'URL obtenue pour l'enregistrer.
            onUploadCompleted: async () => {}
        });

        return res.status(200).json(jsonResponse);
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') {
            return res.status(401).json({ success: false, message: 'Non autorisé' });
        }
        console.error('Erreur upload-token vidéo:', error);
        return res.status(400).json({ success: false, message: error.message || "Impossible de générer le jeton d'upload." });
    }
};
