// Express 4 does not catch errors thrown inside async handlers; this forwards them to the error page.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
