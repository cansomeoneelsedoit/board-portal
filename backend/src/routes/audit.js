const makeRouter = require('./_base');
module.exports = makeRouter('auditLog', {
  include: { meeting: true },
  orderBy: { createdAt: 'desc' },
});
