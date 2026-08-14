/*
 * Who is asking, and what they may do.
 *
 * Board Portal does not authenticate anyone — the host vertical does, and
 * forwards the result. Two levels, matching how a board actually works:
 *
 *   MEMBER  read-only. Sees the meetings they are invited to, opens the pack,
 *           reads papers. Cannot set up meetings or change the SharePoint link.
 *   ADMIN   the board secretary. Sets up meetings, links the library, manages
 *           the register.
 *
 * Standalone (no host) defaults to ADMIN so the app is usable on its own; set
 * BOARD_PORTAL_DEFAULT_ROLE=MEMBER to preview the member experience.
 */

const ROLES = ['MEMBER', 'ADMIN'];

/** Roles the host may send that mean "can administer this board". */
const ADMIN_ROLES = new Set(['ADMIN', 'SECRETARY', 'CHAIR', 'SUPER_ADMIN', 'BOARD_ADMIN']);

function resolveSession(req) {
  const headerRole = (req.headers['x-user-role'] || '').toString().trim().toUpperCase();
  const envRole = (process.env.BOARD_PORTAL_DEFAULT_ROLE || 'ADMIN').trim().toUpperCase();

  const raw = headerRole || envRole;
  const role = ADMIN_ROLES.has(raw) ? 'ADMIN' : ROLES.includes(raw) ? raw : 'MEMBER';

  const isAdmin = role === 'ADMIN';
  // Destroying a meeting and its whole record is above day-to-day admin —
  // the host's top-level roles only. (A secretary or chair administers
  // meetings; they do not erase them.)
  const isTopLevel = isAdmin && ['ADMIN', 'SUPER_ADMIN', 'BOARD_ADMIN'].includes(raw);

  return {
    userId: req.headers['x-user-id'] || null,
    orgKey: req.headers['x-org-key'] || null,
    role,
    capabilities: {
      // Set up meetings, agendas, the register.
      manageMeetings: isAdmin,
      // Point the board at a SharePoint library.
      manageIntegration: isAdmin,
      // Write into the library from inside the portal. Note this only decides
      // what the portal OFFERS — SharePoint still enforces the real permission,
      // so an admin here without write access there will still be refused.
      writeDocuments: isAdmin,
      // Erase a meeting and everything recorded against it.
      deleteMeetings: isTopLevel,
    },
  };
}

/** Guard for routes only a board administrator may call. */
function requireAdmin(req, res, next) {
  if (req.session?.role === 'ADMIN') return next();
  return res.status(403).json({
    error: 'This action needs board administrator access.',
    role: req.session?.role || 'MEMBER',
  });
}

module.exports = { resolveSession, requireAdmin, ROLES };
