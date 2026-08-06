const makeRouter = require('./_base');
module.exports = makeRouter('board', {
  include: { members: true, meetings: { orderBy: { date: 'desc' } } },
  orderBy: { name: 'asc' },
});
