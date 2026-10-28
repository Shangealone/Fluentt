// Synthetic native adapter checks; does not access a microphone or provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const React = local('react');
const babel = local('@babel/core');
const original = Module._load;
let permission, recorder, player, callback, modes;
Module._load = function(name, parent, main) {
  if (name === 'react-native') return { Platform: { OS: 'android' } };
  if (name === 'expo-audio') return {
    RecordingPresets: { HIGH_QUALITY: {} },
    useAudioRecorder() {
      const current = recorder;
      React.useEffect(() => () => current.release(), []);
      return current;
    },
    async requestRecordingPermissionsAsync() { return permission; },
    async setAudioModeAsync(mode) { modes.push(mode); },
    createAudioPlayer() { return player; },
  };
  return original.call(this, name, parent, main);
};
Module._extensions['.ts'] = function(module, filename) {
  module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: [local.resolve('@babel/plugin-transform-typescript'), local.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code, filename);
};
const { useAudioRecorder } = local(path.join(mobile, 'src/features/pronunciation/useAudioRecorder.ts'));
function harness() {
  const slots = [], effects = [];
  let cursor;
  return {
    render() {
      cursor = 0;
      const queue = [], saved = { useState: React.useState, useRef: React.useRef, useCallback: React.useCallback, useEffect: React.useEffect };
      React.useState = init => { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; };
      React.useRef = init => { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }); };
      React.useCallback = (fn, deps) => { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, j) => !Object.is(v, prior.deps[j]))) slots[i] = { fn, deps }; return slots[i].fn; };
      React.useEffect = (fn, deps) => { const i = cursor++, prior = effects[i]; if (!prior || deps.some((v, j) => !Object.is(v, prior.deps[j]))) queue.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); };
      try { const result = useAudioRecorder(); queue.forEach(fn => fn()); return result; } finally { Object.assign(React, saved); }
    },
    unmount() { effects.forEach(e => e?.cleanup?.()); },
  };
}
function setup() {
  modes = [];
  permission = { granted: true, canAskAgain: true };
  recorder = { uri: 'file:///synthetic.m4a', prepared: 0, started: 0, stopped: 0, released: 0,
    async prepareToRecordAsync() { this.prepared++; }, record() { this.started++; }, async stop() { this.stopped++; }, release() { this.released++; } };
  player = { played: 0, paused: 0, released: 0, removed: 0,
    addListener(event, fn) { assert.equal(event, 'playbackStatusUpdate'); callback = fn; return { remove: () => this.removed++ }; },
    play() { this.played++; }, pause() { this.paused++; }, release() { this.released++; } };
  return harness();
}
test('blocked microphone permission never starts native recording', async () => {
  const h = setup(); permission = { granted: false, canAskAgain: false };
  try { await h.render().startRecording(); assert.equal(h.render().status, 'permission_blocked'); assert.equal(recorder.prepared, 0); assert.equal(recorder.started, 0); } finally { h.unmount(); }
});
test('native stop retains the recording URI and playback status uses milliseconds', async () => {
  const h = setup(), now = Date.now;
  try {
    Date.now = () => 1000;
    await h.render().startRecording(); assert.equal(h.render().status, 'recording'); assert.equal(recorder.prepared, 1); assert.equal(recorder.started, 1);
    Date.now = () => 2500;
    await h.render().stopRecording(); assert.equal(h.render().status, 'recorded'); assert.equal(recorder.stopped, 1);
    assert.deepEqual(h.render().audioPayload, { uri: recorder.uri, name: 'recording.m4a', type: 'audio/m4a' });
    await h.render().playRecording(); assert.equal(player.played, 1);
    callback({ isLoaded: true, currentTime: 0.8, didJustFinish: false }); assert.equal(h.render().playbackPositionMs, 800);
    callback({ isLoaded: true, currentTime: 1.5, didJustFinish: true }); assert.equal(h.render().status, 'recorded'); assert.equal(h.render().playbackPositionMs, 0);
    await h.render().discardRecording(); assert.equal(h.render().audioPayload, null); assert.equal(player.released, 1); assert.equal(player.removed, 1);
    assert.deepEqual(modes.map(m => m.allowsRecording), [true, false]);
  } finally { Date.now = now; h.unmount(); }
});
test('unmount leaves recorder disposal to the owning Expo hook', async () => {
  const h = setup(); await h.render().startRecording(); h.unmount(); assert.equal(recorder.released, 1); assert.equal(recorder.stopped, 0);
});
