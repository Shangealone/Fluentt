import { apiClient, AuthenticationError, getApiBaseUrl } from '../api/client';
import { ContractError } from '../api/contracts';
import { getSessionEpoch, loadAuthenticatedAccount } from '../auth/tokenStore';
import { parseAssessment, parseCapabilities, parseRecognition, SpeechRequest } from './types';

function assertSpeechTransport() {
  const url = new URL(getApiBaseUrl());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (!__DEV__ && url.protocol !== 'https:')) {
    throw new ContractError('Speech requires a secure HTTPS connection in release builds.');
  }
}

async function assertOwner(owner: string, epoch: number) {
  const account = await loadAuthenticatedAccount();
  if (getSessionEpoch() !== epoch || account?.userId !== owner) throw new AuthenticationError(401, null, 'Authenticated session changed.');
}
function deadline(original: AbortSignal | undefined, milliseconds: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (original?.aborted) abort();
  original?.addEventListener('abort', abort);
  const timer = setTimeout(abort, milliseconds);
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); original?.removeEventListener('abort', abort); } };
}
export async function getSpeechCapabilities(language: 'en' | 'fil', expectedUserId: string, signal?: AbortSignal) {
  assertSpeechTransport();
  const epoch = getSessionEpoch();
  await assertOwner(expectedUserId, epoch);
  const request = deadline(signal, 15000);
  let value: unknown;
  try { value = await apiClient(`/speech/capabilities?language_code=${language}`, { expectedUserId, signal: request.signal }); }
  finally { request.dispose(); }
  await assertOwner(expectedUserId, epoch);
  const result = parseCapabilities(value);
  if (result.language_code !== language) throw new ContractError('Speech language changed.');
  return result;
}
async function send(kind: 'recognition' | 'assessment', input: SpeechRequest, pcm: ArrayBuffer) {
  assertSpeechTransport();
  const epoch = getSessionEpoch();
  await assertOwner(input.expectedUserId, epoch);
  if (!pcm.byteLength || pcm.byteLength % 2 || pcm.byteLength > 1000000 || input.channels !== 1 ||
      input.sampleRateHz < 8000 || input.sampleRateHz > 48000 || pcm.byteLength / 2 / input.sampleRateHz > 10) throw new ContractError('Invalid PCM recording.');
  const request = deadline(input.signal, 45000);
  let value: unknown;
  try { value = await apiClient(`/speech/${kind === 'recognition' ? 'recognitions' : 'assessments'}`, {
    method: 'POST', body: pcm, bodyKind: 'binary', allowAuthReplay: false,
    expectedUserId: input.expectedUserId, signal: request.signal,
    headers: { 'X-Speech-Request-Id': input.requestId, 'X-Speech-Session-Id': input.sessionId,
      'X-Speech-Sequence': String(input.sequence), 'X-Speech-Final': String(input.isFinal),
      'X-Audio-Sample-Rate': String(input.sampleRateHz), 'X-Audio-Channels': '1',
      'X-Content-Item-Id': input.itemId, 'X-Content-Revision-Id': input.revisionId, 'X-Content-Release-Id': input.releaseId,
      [`X-${kind === 'recognition' ? 'Recognition' : 'Assessment'}-Consent`]: input.consentVersion },
  }); } finally { request.dispose(); }
  await assertOwner(input.expectedUserId, epoch);
  return value;
}
export async function recognizeSnapshot(input: SpeechRequest, pcm: ArrayBuffer) {
  const result = parseRecognition(await send('recognition', input, pcm));
  if (result.request_id !== input.requestId || result.sequence !== input.sequence || result.is_final !== input.isFinal) throw new ContractError('Speech request changed.');
  return result;
}
export async function assessRecording(input: SpeechRequest, pcm: ArrayBuffer) {
  if (!input.isFinal) throw new ContractError('Finish recording first.');
  const result = parseAssessment(await send('assessment', input, pcm));
  if (result.request_id !== input.requestId) throw new ContractError('Assessment request changed.');
  return result;
}
