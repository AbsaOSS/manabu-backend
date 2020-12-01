const contributionRequestStatus = require('../models/courseRequestStatus');
module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    contributionRequestId: { type: 'string', required: true },
    adminRequestor: { type: 'string', required: true },
    courseTitle: { type: 'string', required: true },
    courseId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    userName: { type: 'string', required: true },
    userSurname: { type: 'string', required: true },
    status: { type: 'string', defaultsTo: contributionRequestStatus.PENDING },
    requestSeen: { type: 'boolean', defaultsTo: true }
  }
};
