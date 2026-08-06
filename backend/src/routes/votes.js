const makeRouter = require('./_base');
module.exports = makeRouter('vote', { include: { user: true, motion: true } });
