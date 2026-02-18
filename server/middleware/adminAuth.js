const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function requireAdmin(req, res, next) {
  const user = req.session?.user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isAdminEmail(user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { isAdminEmail, requireAdmin };
