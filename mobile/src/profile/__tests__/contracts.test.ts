import { adaptProfileFromApi } from '../api';
import { ACCOUNT, PROFILE, profileWire } from '../../testUtils/contracts';

it('keeps the account UUID, profile UUID and participant code distinct', () => {
  const profile = adaptProfileFromApi(profileWire);
  expect(profile).toMatchObject({ id: PROFILE, userId: ACCOUNT, participantCode: 'P_D6',
    interfaceLanguage: null, targetLearningLanguage: 'en' });
  expect(profile.id).not.toBe(profile.userId);
});

it('rejects a missing account identity instead of using the profile UUID', () => {
  const { user_id: _account, ...invalid } = profileWire;
  expect(() => adaptProfileFromApi(invalid)).toThrow();
});
