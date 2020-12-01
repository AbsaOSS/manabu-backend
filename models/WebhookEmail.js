module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    email: { type: 'string', required: true },
    course: { type: 'string', required: true },
    completion: { type: 'boolean' }
  }
};
