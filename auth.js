const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ message: "token manquant ou invalide" })
    }
    const token = authHeader.split(" ")[1]
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("decoded :", decoded)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(403).json({ message: "token invalide ou expire" })
    }
}
module.exports = authenticateToken;