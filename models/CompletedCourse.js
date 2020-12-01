module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    username: { type: 'string', required: true },
    courseName: { type: 'string', required: true },
    date: { type: 'string', required: true },
    image: { type: 'string' },
    watched: { type: 'number', defaultsTo: 1 }
  }
};
