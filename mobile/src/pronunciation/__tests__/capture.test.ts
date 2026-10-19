import { CaptureController, CaptureDependencies, CaptureSnapshot } from '../capture';

function setup() {
  const states: CaptureSnapshot[] = [];
  const session = { prepare: jest.fn(async () => undefined), record: jest.fn(), stop: jest.fn(async () => undefined), status: () => ({ durationMs: 1200, isRecording: true }), uri: () => 'file:///cache/practice.m4a', release: jest.fn() };
  const deps: CaptureDependencies = { permission: jest.fn(async () => ({ granted: true, canAskAgain: true })), requestPermission: jest.fn(async () => ({ granted: true, canAskAgain: true })), create: () => session, size: () => 1024, remove: jest.fn() };
  const controller = new CaptureController(deps, value => states.push(value));
  return { controller, deps, session, states };
}

it('keeps validated audio for submit and deletes it on cancellation', async () => {
  const { controller, deps, session, states } = setup();
  await controller.start();
  await controller.stop();
  expect(states.at(-1)).toMatchObject({ state: 'recorded', recording: { uri: 'file:///cache/practice.m4a' } });
  expect(session.release).toHaveBeenCalledTimes(1);
  expect(deps.remove).not.toHaveBeenCalled();
  await controller.cancel();
  expect(deps.remove).toHaveBeenCalledWith('file:///cache/practice.m4a');
  expect(states.at(-1)?.state).toBe('ready');
});

it('cleans up invalid audio instead of exposing it for upload', async () => {
  const { controller, deps, states } = setup();
  deps.size = () => 262145;
  await controller.start(); await controller.stop();
  expect(states.at(-1)).toMatchObject({ state: 'error', error: 'invalidRecording' });
  expect(states.at(-1)?.recording).toBeUndefined();
  expect(deps.remove).toHaveBeenCalled();
});

it('never starts the microphone immediately after permission is granted', async () => {
  const { controller, deps, session, states } = setup();
  deps.permission = async () => ({ granted: false, canAskAgain: true });
  await controller.start();
  expect(states.at(-1)?.state).toBe('ready');
  expect(session.record).not.toHaveBeenCalled();
});

it('fences delayed permission completion after disposal', async () => {
  const { controller, deps, session } = setup();
  let resolve!: (value: { granted: boolean; canAskAgain: boolean }) => void;
  deps.permission = () => new Promise(done => { resolve = done; });
  const pending = controller.start();
  await Promise.resolve(); await Promise.resolve();
  const disposed = controller.dispose();
  resolve({ granted: true, canAskAgain: true });
  await pending; await disposed;
  expect(session.record).not.toHaveBeenCalled();
});
