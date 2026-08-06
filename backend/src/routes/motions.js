const makeRouter = require('./_base');
module.exports = makeRouter('motion', {
  include: { meeting: true, votes: { include: { user: true } } },
  orderBy: { createdAt: 'desc' },
});
