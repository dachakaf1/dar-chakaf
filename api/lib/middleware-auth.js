const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET manquant : ajoutez-le dans les variables d\'environnement (Vercel → Settings → Environment Variables).');
}

function generateToken(user) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET manquant');
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    if (!JWT_SECRET) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('❌ verifyToken a échoué:', error.name, '-', error.message);
        return null;
    }
}

function requireAuth(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        throw new Error('UNAUTHORIZED');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        throw new Error('UNAUTHORIZED');
    }

    return decoded;
}

// Comme requireAuth, mais ne lève jamais d'erreur : renvoie l'utilisateur
// décodé si un token valide est présent, sinon null. Utile pour les
// endpoints publics qui doivent quand même montrer les brouillons à un
// admin connecté (aperçu) tout en les cachant aux visiteurs normaux.
function optionalAuth(req) {
    try {
        return requireAuth(req);
    } catch (error) {
        return null;
    }
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    optionalAuth
};
