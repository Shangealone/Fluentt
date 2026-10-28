// Synthetic browser-demo state only; real enrollment is checked by PostgreSQL tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const ts = local('typescript');
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (module, file) => module._compile(ts.transpileModule(
    fs.readFileSync(file, 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
  ).outputText, file);
}
const { demoStore, createDemoClassesApi, createDemoEnrollmentApi } = local(path.join(mobile, 'src/demo/demoData.ts'));

test('a newly generated demo code opens only its own class and creates one membership', async () => {
  demoStore.reset();
  const classes = createDemoClassesApi();
  const enrollment = createDemoEnrollmentApi();
  const originalRandom = Math.random;
  Math.random = () => 0.000042;
  try {
    const created = await classes.create({ class_name: 'Synthetic new class', grade_level: 9,
      language: 'english', description: null }, 'qa-create');
    assert.equal(created.join_code, '000042');
    assert.equal((await classes.get(created.id)).join_code, created.join_code);
    const preview = await enrollment.preview(created.join_code);
    assert.equal(preview.class_name, created.class_name);
    assert.equal(preview.grade_level, 9);
    assert.equal(preview.language, 'english');
    assert.match(preview.class_version, /^[0-9a-f]{64}$/);
    await assert.rejects(enrollment.preview('000043'), error => error.status === 404);
    const body = { code: created.join_code, class_version: preview.class_version };
    const joined = await enrollment.confirm(body);
    assert.equal(joined.class_id, created.id);
    assert.equal(joined.class_name, created.class_name);
    assert.deepEqual(await enrollment.confirm(body), joined);
    assert.equal((await enrollment.mine()).filter(row => row.class_id === created.id).length, 1);
    assert.equal((await enrollment.mine(1))[0].class_id, 'demo-class-1');
    assert.equal((await enrollment.preview('519302')).class_name, 'Grade 8 - Rizal');
  } finally {
    Math.random = originalRandom;
    demoStore.reset();
  }
});

test('a changed demo class requires a fresh preview, and collisions never duplicate codes', async () => {
  demoStore.reset();
  const classes = createDemoClassesApi();
  const enrollment = createDemoEnrollmentApi();
  const originalRandom = Math.random;
  const values = [0.782041, 0.123456, 0.123456, 0.654321];
  Math.random = () => values.shift() ?? 0.5;
  try {
    const first = await classes.create({ class_name: 'First', grade_level: 5, language: 'tagalog', description: null });
    assert.equal(first.join_code, '123456');
    const old = await enrollment.preview(first.join_code);
    await classes.update(first.id, { class_name: 'Renamed' });
    await assert.rejects(enrollment.confirm({ code: first.join_code, class_version: old.class_version }), error => error.status === 409);
    const fresh = await enrollment.preview(first.join_code);
    assert.equal(fresh.class_name, 'Renamed');
    assert.equal((await enrollment.confirm({ code: first.join_code, class_version: fresh.class_version })).class_name, 'Renamed');
    const second = await classes.create({ class_name: 'Second', grade_level: 6, language: 'english', description: null });
    assert.equal(second.join_code, '654321');
    assert.notEqual(second.id, first.id);
    await assert.rejects(classes.get('missing'), error => error.status === 404);
  } finally {
    Math.random = originalRandom;
    demoStore.reset();
  }
});
