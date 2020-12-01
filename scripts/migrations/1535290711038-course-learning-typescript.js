const { addLesson } = require('../../services/lessonService');
const LessonTypes = require('../../models/LessonTypes');

exports.func = async function migrate(models) {
    const Course = models.getModel('course');
    const Tag = models.getModel('tag');
    const User = models.getModel('user');

    const course = await Course.create({
        title: 'Learning Typescript',
        image: '/api/uploads/Manabu_round_icon_extra04.png',
        rating: 3.8,
        description: 'In this short course, we will learn the basics of Typescript.',
    }).fetch();

    const jon = await User.findOne({ name: 'Jon' });
    const danaerys = await User.findOne({ name: 'Danaerys' });
    const allAuthors = [jon, danaerys];

    const typescript = await Tag.findOne({ label: 'Typescript' });
    const programming = await Tag.findOne({ label: 'Programming' });
    const allTags = [typescript, programming];

    await Course.addToCollection(course.id, 'authors', allAuthors.map(a => a.id));
    await Course.addToCollection(course.id, 'tags', allTags.map(t => t.id));

    await addLesson({
        title: 'Javascript vs. Typescript',
        type: LessonTypes.VIDEO,
        source: '/api/uploads/5dea3c1cfa6ae0c4cf9495c4-5df106e276a23c582d0ecfc2.mp4',
        course: course.id,
        durationInSeconds: 72,
        order: 0,
        markdown: 'We\'ll explain the differences between Javascript and Typescript.',
    }, allAuthors, allTags);
};