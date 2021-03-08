/*
 * Copyright 2020 ABSA Group Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint no-console: 0 */

const initModels = require('../models');
const LessonTypes = require('../models/LessonTypes');

// todo: simple db migration


async function createAuthors() {
    const models = await initModels();
    const User = models.getModel('user');

    // users/authors
    const Cersei = await User.create({
        email: 'cersei@casterlyrock.com',
        name: 'Cersei',
        surname: 'Lannister',
        image: 'Cersei_hs_preview.jpeg',
    }).fetch();

    const Jon = await User.create({
        email: 'jon@thewall.com',
        name: 'Jon',
        surname: 'Snow',
        image: 'Jon-Snow.jpeg',
    }).fetch();



    const Jon = await User.create({
        email: 'zubair@absa.co.za',
        name: 'z',
        surname: 'd',
        image: 'Jon-Snow.jpeg',
    }).fetch();
    const Danaerys = await User.create({
        email: 'dany@dragonstone.com',
        name: 'Danaerys',
        surname: 'Targaryen',
        image: 'Danaerys.jpeg',
    }).fetch();

    return {
        Cersei,
        Jon,
        Danaerys,
    };
}

async function addLesson(lesson, authors, tags) {
    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const lessonRecord = await Lesson.create(lesson).fetch();

    let associationPromises = authors.map(async author => Lesson.addToCollection(
        lessonRecord.id,
        'authors', [
            author.id,
        ],
    ));

    associationPromises = associationPromises.concat(tags.map(async tag => Lesson.addToCollection(
        lessonRecord.id,
        'tags', [
            tag.id,
        ],
    )));

    await Promise.all(associationPromises);
}

async function createTags() {
    const models = await initModels();
    const Tag = models.getModel('tag');

    const ui = await Tag.create({
        label: 'UI',
    }).fetch();

    const celine = await Tag.create({
        label: 'Celine',
    }).fetch();

    const solar = await Tag.create({
        label: 'Solar',
    }).fetch();

    const microUI = await Tag.create({
        label: 'Micro UI',
    }).fetch();

    return {
        ui,
        celine,
        solar,
        microUI,
    };
}

async function setupDevDb() {
    const models = await initModels();

    const User = models.getModel('user');
    const foundUser = await User.find({ email: 'zubair@absa.co.za' });
    if (foundUser.length) {
        console.log('Found user, db was already initialized: ', foundUser);
        return;
    }

    const Tag = models.getModel('tag');
    const Course = models.getModel('course');
    const Lesson = models.getModel('lesson');

    await User.destroy({});
    await Tag.destroy({});
    await Course.destroy({});
    await Lesson.destroy({});

    const {
        Cersei,
        Jon,
        Danaerys,
    } = await createAuthors();

    // tags
    const {
        ui,
        celine,
        solar,
        microUI,
    } = await createTags();
    // courses

    const course = await Course.create({
        title: 'Getting started with Celine',
        image: 'solar.png',
        description: `
Celine is our **Micro UI** framework and design system.

This course will give you some background information about design systems and MicroUIs before delving
into how to set it up a new project on your machine.

In the end of the course, you will learn why it’s important to _contribute back_ to the project and how
to do so.
    `,
    }).fetch();

    await Course.addToCollection(course.id, 'authors', [Cersei.id, Jon.id, Danaerys.id]);
    await Course.addToCollection(course.id, 'tags', [ui.id, celine.id, solar.id, microUI.id]);


    await addLesson({
        title: 'What are micro UI services?',
        type: LessonTypes.VIDEO,
        source: '',
        course: course.id,
        durationInSeconds: 180,
        markdown: `
To get started with **Celine**, you first need to clone the repo from bitbucket. The repo url is [bitbucket.org/celine](bitbucket.org/celine).

To clone the repo, simply drop into the command line at the desired location and run the following command:

<code>git clone bitbucket.org/celine</code>

After doing that, just open up the folder using [Visual studio code](https://code.visualstudio.com/).

Ok, goody. So you have cloned the repo and you've opened it up using [Visual studio code](https://code.visualstudio.com/). Now open up a terminal and run the following command:

<code>yarn</code>

If you don't have [yarn](http://yarnpkg.com) installed yet, install it using the following command:

<code>npm i -g yarn</code>

Sweet! So your packages are installed and you are ready to rock. To start up the project, run the following command:

<code>yarn start</code>

You should see something like this: ![after startup](/images/screenshot.png)

`,
    }, [Cersei], [ui, microUI]);

    await addLesson({
        title: 'How do I clone the repo?',
        type: LessonTypes.MARKDOWN,
        course: course.id,
        durationInSeconds: 300,
        markdown: `
To get started with **Celine**, you first need to clone the repo from bitbucket. The repo url is [bitbucket.org/celine](bitbucket.org/celine).

To clone the repo, simply drop into the command line at the desired location and run the following command:

<code>git clone bitbucket.org/celine</code>

After doing that, just open up the folder using [Visual studio code](https://code.visualstudio.com/).

Ok, goody. So you have cloned the repo and you've opened it up using [Visual studio code](https://code.visualstudio.com/). Now open up a terminal and run the following command:

<code>yarn</code>

If you don't have [yarn](http://yarnpkg.com) installed yet, install it using the following command:

<code>npm i -g yarn</code>

Sweet! So your packages are installed and you are ready to rock. To start up the project, run the following command:

<code>yarn start</code>

You should see something like this: ![after startup](/images/screenshot.png)

`,
    }, [Jon], [celine]);

    await addLesson({
        title: 'Coding your first Celine micro UI thingy',
        type: LessonTypes.VIDEO,
        course: course.id,
        durationInSeconds: 200,
    }, [Danaerys], [
        celine,
        ui,
        microUI,
        solar,
    ]);
}

if (process.argv[2] === '-e') {
    setTimeout(() => {
        setupDevDb()
            .then(() => {
                console.log('Completed setting up the db with seed data!!');
                process.exit(0);
            })
            .catch(err => console.error('error: ', err));
    }, 1000);
}

module.exports = setupDevDb;