import { ApiError } from '../../api/client';
import { readPronunciationResult } from '../api';
import { SubmissionController, SubmissionDependencies, SubmissionSnapshot } from '../submission';
import { metadata, payload } from '../testFixtures';

function setup() {
  const states: SubmissionSnapshot[] = [];
  const deps: SubmissionDependencies = { submit: jest.fn(async () => readPronunciationResult(payload(), metadata)), check: jest.fn(async () => readPronunciationResult(payload('processing'), metadata)) };
  return { deps, states, controller: new SubmissionController('owner', deps, value => states.push(value)) };
}

it('renders server score/category without reclassifying display rounding', async () => {
  const { controller, states } = setup();
  await controller.submit(metadata, 'file:///cache/a.m4a');
  expect(states.at(-1)?.result?.assessment).toEqual({ accuracy_score_display: '90.00', category: 'B' });
});

it('reconciles a lost response under the same identity instead of making a new call', async () => {
  const { controller, deps, states } = setup();
  deps.submit = jest.fn().mockRejectedValue(new Error('offline'));
  await controller.submit(metadata, 'file:///cache/a.m4a');
  expect(states.at(-1)?.state).toBe('uncertain');
  await controller.check();
  expect(deps.submit).toHaveBeenCalledTimes(1);
  expect(deps.check).toHaveBeenCalledWith('owner', metadata, expect.any(AbortSignal));
  expect(states.at(-1)?.state).toBe('processing');
});

it('resends the same audio and metadata only after GET proves the claim absent', async () => {
  const { controller, deps } = setup();
  deps.submit = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(readPronunciationResult(payload(), metadata));
  deps.check = jest.fn().mockRejectedValue(new ApiError(404, {}));
  await controller.submit(metadata, 'file:///cache/a.m4a');
  await controller.check();
  expect(deps.submit).toHaveBeenCalledTimes(2);
  expect(deps.submit).toHaveBeenLastCalledWith('owner', metadata, 'file:///cache/a.m4a', expect.any(AbortSignal));
});

it('does not publish another owner’s late completion or resend after disposal', async () => {
  const { controller, deps, states } = setup();
  let reject!: (error: Error) => void;
  deps.check = () => new Promise((_resolve, done) => { reject = done; });
  await controller.submit(metadata, 'file:///cache/a.m4a');
  const pending = controller.check();
  controller.dispose();
  const count = states.length;
  reject(new ApiError(404, {}));
  await pending;
  expect(states).toHaveLength(count);
  expect(deps.submit).toHaveBeenCalledTimes(1);
});

it.each(['unscorable', 'failed'])('retains %s as an unscored terminal outcome', async (status) => {
  const { controller, deps, states } = setup();
  deps.submit = async () => readPronunciationResult(payload(status), metadata);
  await controller.submit(metadata, 'file:///cache/a.m4a');
  expect(states.at(-1)?.state).toBe(status);
  expect(states.at(-1)?.result?.assessment.category).toBeNull();
});

it('leaves submitting after the deadline even when the transport ignores abort', async () => {
  jest.useFakeTimers();
  try {
    const { controller, deps, states } = setup();
    deps.submit = () => new Promise(() => undefined);
    const pending = controller.submit(metadata, 'file:///cache/a.m4a');
    await jest.advanceTimersByTimeAsync(45_000);
    await pending;
    expect(states.at(-1)?.state).toBe('uncertain');
  } finally { jest.useRealTimers(); }
});
