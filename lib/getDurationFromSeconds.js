const moment = require('moment');
const momentDurationFormatSetup = require('moment-duration-format');

momentDurationFormatSetup(moment);

module.exports = (seconds, showHours) => {
  const format = showHours ? 'h[hr] mm[min]' : undefined;
  return moment.duration(seconds, 'seconds').format(format);
};
