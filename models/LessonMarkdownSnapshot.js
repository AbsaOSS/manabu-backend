module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    lessonId: { type: 'string', required: true },
    markdown: { type: 'string', required: true },
    oldMarkdown: { type: 'string', required: true },
    removed: { type: 'number', required: true },
    added: { type: 'number', required: true },
    author: {
      model: 'user'
    }
  }
};
