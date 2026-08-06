const makeRouter = require('./_base');
module.exports = makeRouter('minutes', {
  include: { meeting: true, approvals: { include: { user: true } } },
  orderBy: { createdAt: 'desc' },
});
