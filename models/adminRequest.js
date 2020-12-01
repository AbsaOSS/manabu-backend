module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    abNumber: { type: 'string', required: true },
    name: { type: 'string', required: true },
    lastName: { type: 'string', required: true },
    email: { type: 'string', required: true }
  }
};
