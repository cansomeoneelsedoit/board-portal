const makeRouter = require('./_base');
module.exports = makeRouter('meeting', {
  include: {
    board: true,
    agendaItems: { orderBy: { order: 'asc' }, include: { documents: true } },
    invitations: { include: { user: true } },
    attendances: { include: { user: true } },
    motions: { include: { votes: { include: { user: true } } } },
    minutes: true,
  },
  orderBy: { date: 'desc' },
});
