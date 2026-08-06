const makeRouter = require('./_base');
module.exports = makeRouter('cOI', {
  include: { user: true },
  orderBy: { declaredAt: 'desc' },
});
