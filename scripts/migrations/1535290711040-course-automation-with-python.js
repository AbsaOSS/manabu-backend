const { addLesson } = require('../../services/lessonService');
const LessonTypes = require('../../models/LessonTypes');

exports.func = async function migrate(models) {
    const Course = models.getModel('course');
    const Tag = models.getModel('tag');
    const User = models.getModel('user');

    const course = await Course.create({
        title: 'Automation With Python',
        image: '/api/uploads/Manabu_Python_round_icon.png',
        rating: 4.5,
        description: 'Let us begin our journey of automating simple tasks using the elegant programming language of Python.',
    }).fetch();

    const albus = await User.findOne({ name: 'Albus' });
    const severus = await User.findOne({ name: 'Severus' });
    const allAuthors = [albus, severus];

    const python = await Tag.findOne({ label: 'Python' });
    const programming = await Tag.findOne({ label: 'Programming' });
    const robotics = await Tag.findOne({ label: 'Robotics' });
    const algorithms = await Tag.findOne({ label: 'Algorithms' });
    const allTags = [python, programming, robotics, algorithms];

    await Course.addToCollection(course.id, 'authors', allAuthors.map(a => a.id));
    await Course.addToCollection(course.id, 'tags', allTags.map(t => t.id));

    await addLesson({
        title: 'Is automation necessary?',
        type: LessonTypes.VIDEO,
        source: '/api/uploads/5dea3c1cfa6ae0c4cf9495c4-5df0fef11e52e654614163fc.mp4',
        course: course.id,
        durationInSeconds: 42,
        order: 0,
        markdown: 'A brief look at the history of automation.',
    }, allAuthors, allTags);
};