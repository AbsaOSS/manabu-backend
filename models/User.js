module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    email: { type: 'string', required: true },
    name: { type: 'string', required: true },
    surname: { type: 'string', required: true },
    image: { type: 'string', required: false },
    profileUrlLink: { type: 'string', required: false },
    aboutAuthor: { type: 'string', required: false },
    role: { type: 'string', required: false },
    courses: {
      collection: 'course',
      via: 'authors'
    },
    lessons: {
      collection: 'lesson',
      via: 'authors'
    }
  }
};
