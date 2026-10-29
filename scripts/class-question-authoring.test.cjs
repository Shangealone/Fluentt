// Synthetic in-memory demo checks; no real learner, grade, or live question-bank claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const ts = local('typescript');
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText, file,
);
const { demoStore, createDemoClassesApi, createDemoQuestion, createDemoAssignmentApi,
  createDemoCaptureApi } = local(path.join(mobile, 'src/demo/demoData.ts'));
const { choiceItemFromRevision } = local(path.join(mobile, 'src/features/questions/choice.ts'));
const { textItemFromRevision } = local(path.join(mobile, 'src/features/questions/text.ts'));
const { multiItemFromRevision } = local(path.join(mobile, 'src/features/questions/multi.ts'));
const { arrangementItemFromRevision } = local(path.join(mobile, 'src/features/questions/arrangement.ts'));
const { matchingItemFromRevision } = local(path.join(mobile, 'src/features/questions/matching.ts'));
const { flashcardFrontFromRevision } = local(path.join(mobile, 'src/features/questions/flashcards.ts'));

test('new demo class can author private-keyed questions, select exact revisions, and deliver them', async () => {
  demoStore.reset();
  try {
    const classroom = await createDemoClassesApi().create({
      class_name: 'Synthetic science class', grade_level: 6, language: 'english', description: null,
    });
    const api = createDemoAssignmentApi();
    const lessons = await api.lessons(classroom.id);
    assert.equal(lessons.items.length, 1);
    const lessonId = lessons.items[0].lesson_id;
    const choice = createDemoQuestion(classroom.id, lessonId, {
      method: 'multiple_choice', prompt: 'Which planet is closest to the Sun?',
      options: ['Venus', 'Mercury', 'Mars', 'Earth'], correct_option: 1,
    });
    const identification = createDemoQuestion(classroom.id, lessonId, {
      method: 'identification', prompt: 'Name the star at the center of our solar system.', expected_text: 'Sun',
    });
    assert.equal(choice.definition.content.options[1].text, 'Mercury');
    assert(!JSON.stringify(choice).includes('correct_option_id'));
    assert(!JSON.stringify(identification).includes('Sun"}'));
    assert.equal(demoStore.privateAnswerKeys[choice.id].correct_option_id, choice.definition.content.options[1].id);
    assert.equal((await api.questions(classroom.id, lessonId, '', 'multiple_choice')).items.length, 1);
    assert.equal((await api.questions('demo-class-1', lessonId)).items.length, 0);
    const input = { lesson_id: lessonId, title: 'Synthetic science activity', instructions: null,
      question_revision_ids: [choice.id, identification.id] };
    const draft = await api.create(classroom.id, input, 'create-1');
    assert.deepEqual(draft.questions.map(item => item.id), input.question_revision_ids);
    assert.equal((await api.list(classroom.id)).items.find(row => row.id === draft.id).question_count, 2);
    await api.publish(draft, 'publish-1');
    const attempt = await createDemoCaptureApi().start(draft.id);
    assert.equal(attempt.class_id, classroom.id);
    assert.deepEqual(attempt.questions.map(item => item.id), input.question_revision_ids);
    assert(!JSON.stringify(attempt).includes('correct_option_id'));
    assert(!JSON.stringify(attempt).includes('accepted_answers'));
    const submitted = await createDemoCaptureApi().submit(attempt, { position: 2, responses: [
      { assignment_question_id: attempt.questions[0].assignment_question_id,
        answer: { option_id: choice.definition.content.options[1].id } },
      { assignment_question_id: attempt.questions[1].assignment_question_id, answer: { text: 'Moon' } },
    ] });
    assert.equal(submitted.immediate_score.status, 'complete');
    assert.equal(submitted.immediate_score.earned_points, '1.00');
    assert.equal(submitted.immediate_score.possible_points, '2.00');
    assert.equal((await createDemoCaptureApi().read(attempt.id)).immediate_score.earned_points, '1.00');
    assert(!JSON.stringify(submitted).includes('correct_option_id'));
  } finally { demoStore.reset(); }
});

test('demo authoring rejects wrong class/lesson, invalid choices, and missing answer', async () => {
  demoStore.reset();
  try {
    const classroom = await createDemoClassesApi().create({
      class_name: 'Another synthetic class', grade_level: 5, language: 'tagalog', description: null,
    });
    const lessonId = (await createDemoAssignmentApi().lessons(classroom.id)).items[0].lesson_id;
    assert.throws(() => createDemoQuestion('demo-class-missing', lessonId, {
      method: 'true_false', prompt: 'A statement', correct_boolean: true,
    }), /active demo class/);
    assert.throws(() => createDemoQuestion(classroom.id, 'wrong-lesson', {
      method: 'true_false', prompt: 'A statement', correct_boolean: true,
    }), /Choose a lesson/);
    assert.throws(() => createDemoQuestion(classroom.id, lessonId, {
      method: 'multiple_choice', prompt: 'A question', options: ['A', 'B', '', 'D'], correct_option: 0,
    }), /choices/);
    assert.throws(() => createDemoQuestion(classroom.id, lessonId, {
      method: 'identification', prompt: 'A question', expected_text: '',
    }), /expected answer/);
    assert.equal((await createDemoAssignmentApi().questions(classroom.id, lessonId)).items.length, 0);
  } finally { demoStore.reset(); }
});

test('all ten authored types have valid student views and exact published delivery', async () => {
  demoStore.reset();
  try {
    const classroom = await createDemoClassesApi().create({
      class_name: 'Synthetic ten-method class', grade_level: 7, language: 'english', description: null,
    });
    const api = createDemoAssignmentApi();
    const lessonId = (await api.lessons(classroom.id)).items[0].lesson_id;
    const cases = [
      { method: 'multiple_choice', prompt: 'Which is first?', options: ['A', 'B', 'C', 'D'], correct_option: 0 },
      { method: 'true_false', prompt: 'The sun is a star.', correct_boolean: true },
      { method: 'identification', prompt: 'Name our star.', expected_text: 'Sun' },
      { method: 'fill_in_the_blank', prompt: 'The ___ rises in the ___.', blank_answers: ['sun', 'east'] },
      { method: 'multiple_select', prompt: 'Choose two vowels.', options: ['A', 'B', 'E', 'T'], correct_options: [0, 2] },
      { method: 'flashcards', prompt: 'Recall the word.', cue: 'Habitat', back: 'The natural home of an organism.' },
      { method: 'error_identification', prompt: 'Find the incorrect part.', tokens: ['The', 'cat', 'are', 'here.'], error_tokens: [2] },
      { method: 'word_arrangement', prompt: 'Arrange the words.', ordered_units: ['I', 'like', 'pizza'] },
      { method: 'sentence_arrangement', prompt: 'Arrange the events.', ordered_units: ['First, we wake up.', 'Then, we eat.'] },
      { method: 'matching_type', prompt: 'Match words and numbers.', pairs: [{ left: 'One', right: '1' }, { left: 'Two', right: '2' }] },
    ];
    const items = cases.map(input => createDemoQuestion(classroom.id, lessonId, input));
    assert.equal(new Set(items.map(item => item.definition.method)).size, 10);
    for (const item of items) {
      const method = item.definition.method;
      const projected = ['multiple_choice', 'true_false'].includes(method) ? choiceItemFromRevision(item)
        : ['identification', 'fill_in_the_blank'].includes(method) ? textItemFromRevision(item)
        : ['multiple_select', 'error_identification'].includes(method) ? multiItemFromRevision(item)
        : ['word_arrangement', 'sentence_arrangement'].includes(method) ? arrangementItemFromRevision(item)
        : method === 'matching_type' ? matchingItemFromRevision(item) : flashcardFrontFromRevision(item);
      assert(projected, `Student projection failed for ${method}`);
      assert.equal((await api.questions(classroom.id, lessonId, '', method)).items.length, 1);
      assert(!JSON.stringify(item).includes('answer_key'));
    }
    assert.equal(items[7].definition.content.items[0].text, 'pizza');
    assert.equal(items[8].definition.content.items[0].text, 'Then, we eat.');
    assert.equal(items[9].definition.content.right[0].text, '2');
    const draft = await api.create(classroom.id, { lesson_id: lessonId, title: 'All ten methods', instructions: null,
      question_revision_ids: items.map(item => item.id) }, 'ten-create');
    await api.publish(draft, 'ten-publish');
    const capture = createDemoCaptureApi();
    const attempt = await capture.start(draft.id);
    assert.deepEqual(attempt.questions.map(item => item.definition.method), cases.map(item => item.method));
    assert(!JSON.stringify(attempt).includes('The natural home of an organism.'));
    const flashcard = attempt.questions.find(item => item.definition.method === 'flashcards');
    const revealed = await capture.reveal(attempt, flashcard);
    assert.equal(revealed.back, 'The natural home of an organism.');
    assert.equal((await capture.read(attempt.id)).revealed_item_ids.includes(flashcard.assignment_question_id), true);
    await assert.rejects(capture.reveal(attempt, attempt.questions[0]), /unavailable/);
  } finally { demoStore.reset(); }
});
