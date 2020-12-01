module.exports = {
    attributes: {
        id: { type: 'string', columnName: '_id' },
        question: { type: 'string', required: true },
        option1: { type: 'string', required: true },
        option2: { type: 'string', required: true },
        option3: { type: 'string', required: false },
        option4: { type: 'string', required: false },
        answer: { type: 'string', required: true },
        courseId: { type: 'string', required: true },
        lessonId: { type: 'string', required: true },
        questionType: { type: 'string', required: true }
    }
};