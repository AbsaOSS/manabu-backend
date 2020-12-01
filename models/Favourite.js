module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    status: { type: 'number', required: true }
  }
};
