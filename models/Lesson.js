module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    title: { type: 'string', required: true },
    type: { type: 'string' },
    markdown: { type: 'string' },
    source: { type: 'string' },
    category: { type: 'string' },
    durationInSeconds: { type: 'number', defaultsTo: 0 },
    order: { type: 'number', required: true },
    tags: {
      collection: 'tag',
      via: 'lessons'
    },
    authors: {
      collection: 'user',
      via: 'lessons'
    },
    course: {
      model: 'course'
    },
    trueOrFalseQuestions: {
      collection: 'trueorfalsequestion'
    },
    multipleChoiceQuestions: {
      collection: 'multiplechoicequestion'
    }
  }
};
