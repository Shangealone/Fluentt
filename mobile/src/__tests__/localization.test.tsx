import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { AppText } from '../components/AppText';
import { setInterfaceLanguage } from '../i18n';

describe('Localization', () => {
  beforeEach(async () => {
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  it('renders English text by default', async () => {
    await render(<AppText i18nKey="auth.login" />);
    expect(screen.getByText(/Log in/i)).toBeTruthy();
  });

  it('renders Tagalog text when interface language is set to fil', async () => {
    await act(async () => {
      await setInterfaceLanguage('fil');
    });
    await render(<AppText i18nKey="auth.login" />);
    expect(screen.getByText(/Mag-login/i)).toBeTruthy();
  });

  it('falls back to English for a missing Tagalog key', async () => {
    await act(async () => {
      await setInterfaceLanguage('fil');
    });
    await render(<AppText i18nKey="auth.onlyInEnglish" />);
    expect(screen.getByText(/English only string/i)).toBeTruthy();
  });
});
