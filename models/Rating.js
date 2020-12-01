module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    userId: { type: 'string', required: true },
    userName: { type: 'string' },
    userSurname: { type: 'string' },
    userRating: { type: 'number', defaultsTo: 0 },
    userComment: { type: 'string', required: false },
    courseTitle: { type: 'string' },
    date: { type: 'string', required: true },
    isPublished: { type: 'number', defaultsTo: 0 },
    userImage: { type: 'string', required: false },
    courseId: {
      model: 'course'
    }
  }
};
