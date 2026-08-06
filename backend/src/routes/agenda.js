const makeRouter = require('./_base');
module.exports = makeRouter('agendaItem', {
  include: { documents: true },
  orderBy: { order: 'asc' },
});
