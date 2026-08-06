const makeRouter = require('./_base');
module.exports = makeRouter('document', {
  include: { agendaItem: true },
  orderBy: { createdAt: 'desc' },
});
