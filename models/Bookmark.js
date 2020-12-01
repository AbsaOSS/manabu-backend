module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    lessonId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    duration: { type: 'string', required: true }
  }
};
