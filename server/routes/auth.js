const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const db = require('../db');

const router = express.Router();

const JWKS = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys')
);

const VANDY_DOMAIN = 'vanderbilt.edu';

function isVanderbiltEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return email.toLowerCase().endsWith(`@${VANDY_DOMAIN}`);
}

function getEmailFromClaims(claims) {
  return (
    claims.email ||
    claims.preferred_username ||
    claims.upn ||
    claims.unique_name ||
    ''
  );
}

function isValidIssuer(issuer) {
  return (
    typeof issuer === 'string' &&
    issuer.startsWith('https://login.microsoftonline.com/') &&
    issuer.endsWith('/v2.0')
  );
}

function nameFromClaims(email, claims) {
  if (claims.name && typeof claims.name === 'string') {
    return claims.name.slice(0, 255);
  }
  const localPart = (email.split('@')[0] || 'User')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

  return (localPart || 'Vanderbilt User').slice(0, 255);
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

router.post('/microsoft/login', async function(req, res) {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ message: 'Server is missing MICROSOFT_CLIENT_ID' });
  }

  if (!idToken) {
    return res.status(400).json({ message: 'Missing idToken' });
  }

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      audience: clientId,
    });

    if (!isValidIssuer(payload.iss)) {
      return res.status(401).json({ message: 'Invalid token issuer' });
    }

    const email = getEmailFromClaims(payload);
    if (!isVanderbiltEmail(email)) {
      return res.status(403).json({ message: 'Only @vanderbilt.edu accounts are allowed.' });
    }

    const oauthId = payload.oid || payload.sub;
    const name = nameFromClaims(email, payload);

    const result = await db.query(
      `
        INSERT INTO users (email, password_hash, name, oauth_provider, oauth_id)
        VALUES ($1, NULL, $2, 'microsoft', $3)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          oauth_provider = EXCLUDED.oauth_provider,
          oauth_id = EXCLUDED.oauth_id,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, email, name
      `,
      [email.toLowerCase(), name, oauthId]
    );

    const user = result.rows[0];
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: getInitials(user.name),
    };

    return res.json({ authenticated: true, user: req.session.user });
  } catch (error) {
    console.error('Microsoft login error:', error.message || error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

router.get('/me', function(req, res) {
  if (!req.session?.user) {
    return res.status(401).json({ authenticated: false });
  }

  // Ensure initials are always present
  const user = {
    ...req.session.user,
    initials: req.session.user.initials || getInitials(req.session.user.name),
  };

  return res.json({ authenticated: true, user });
});

router.post('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) {
      return res.status(500).json({ message: 'Unable to logout right now.' });
    }

    res.clearCookie('courseflix.sid');
    return res.status(200).json({ message: 'Logged out.' });
  });
});

module.exports = router;
