module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    lessonId: { type: 'string', required: true },
    courseId: { type: 'string', required: true },
    progress: { type: 'number', required: true },
    user: { type: 'string', required: true },
    date: { type: 'string', required: true }
  }
};
