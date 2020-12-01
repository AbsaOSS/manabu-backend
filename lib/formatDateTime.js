const moment = require('moment');

module.exports = function formatDateTime(ticks) {
  const parsed = moment(new Date(ticks));

  if (!parsed.isValid()) {
    return ticks;
  }

  return parsed.format('DD MMMM YYYY, HH:mm:ss');
};
