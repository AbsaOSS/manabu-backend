module.exports = {
    attributes: {
        id: { type: 'string', columnName: '_id' },
        label: { type: 'string', required: true },
        courses: {
            collection: 'course',
            via: 'tags'
        },
        lessons: {
            collection: 'lesson',
            via: 'tags'
        }
    }
};