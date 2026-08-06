const makeRouter = require('./_base');
module.exports = makeRouter('attendance', {
  include: { user: true, meeting: true },
});
