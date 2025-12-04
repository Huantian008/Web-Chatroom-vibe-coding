const adminHelper = require('../utils/adminHelper');

const requireAdmin = (req, res, next) => {
    const username = req.user?.username;

    if (!username || !adminHelper.isAdmin(username)) {
        return res.status(403).json({
            error: '需要管理员权限'
        });
    }

    next();
};

module.exports = { requireAdmin };
