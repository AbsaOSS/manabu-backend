module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    abNumber: { type: 'string', required: true },
    userName: { type: 'string', required: true },
    userSurname: { type: 'string', required: true }
  }
};
