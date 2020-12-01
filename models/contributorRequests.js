module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    adminRequestorId: { type: 'string', required: true },
    adminRequestorName: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    courseTitle: { type: 'string', required: true },
    courseImage: { type: 'string', required: true },
    courseDescription: { type: 'string', required: true },
    requestSeen: { type: 'boolean', defaultsTo: false }
  }
};
