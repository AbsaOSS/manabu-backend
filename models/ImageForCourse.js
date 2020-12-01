module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    source: { type: 'string', required: true },
    category: { type: 'string', required: true }
  }
};
