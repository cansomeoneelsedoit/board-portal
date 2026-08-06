const makeRouter = require('./_base');
module.exports = makeRouter('proxy', {
  include: { fromUser: true, toUser: true },
  orderBy: { lodgedAt: 'desc' },
});
