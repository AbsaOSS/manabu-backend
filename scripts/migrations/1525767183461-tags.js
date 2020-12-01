
exports.func = async function migrate(models) {
  const Tag = models.getModel('tag');
  const listOfTagsToBeCreated = [
    { label: 'UI' },
    { label: 'Typescript' },
    { label: 'Single Page Applications' },
    { label: 'Programming' },
    { label: 'Python' },
    { label: 'Sorting' },
    { label: 'Algorithms' },
    { label: 'Visual Effects' },
    { label: 'Colours' },
    { label: 'Comprehension' },
    { label: 'Robotics' }
  ];

  for (let counter = 0; counter < listOfTagsToBeCreated.length; counter++) {
    await Tag.create(listOfTagsToBeCreated[counter]).fetch();
  }
};
