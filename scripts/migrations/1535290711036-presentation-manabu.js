const fs = require('fs');

exports.func = async function migrate(models) {
  const Presentation = models.getModel('presentation');

  const fileContent = fs.readFileSync('./public/files/gettingStartedWithManabu.txt', 'utf8');

  await Presentation.create({
    title: 'Getting Started with Manabu',
    slides: fileContent,
    author: 'Jon',
    createdBy: 'user',
    transitionType: 'zoom',
    theme: 'black',
  }).fetch();
};
