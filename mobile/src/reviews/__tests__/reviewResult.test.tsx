import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ReviewResultScreen from '../../../app/(app)/review/result';
import { setInterfaceLanguage } from '../../i18n';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {
  totalCount: '5',
  syncedCount: '3',
  queuedCount: '2',
  lessonId: 'lesson-1',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => mockParams,
}));

describe('ReviewResultScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {
      totalCount: '5',
      syncedCount: '3',
      queuedCount: '2',
      lessonId: 'lesson-1',
    };
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  it('renders review completion summary with correct breakdown and pending sync notice', async () => {
    const rendered = await render(<ReviewResultScreen />);

    expect(rendered.getByTestId('result-title')).toBeTruthy();
    expect(rendered.getByText('Review Completed!')).toBeTruthy();
    expect(rendered.getByTestId('total-reviewed-count').props.children).toBe(5);
    expect(rendered.getByTestId('synced-count').props.children).toBe(3);
    expect(rendered.getByTestId('queued-count').props.children).toBe(2);

    // Shows sync pending notice
    expect(rendered.getByTestId('sync-pending-notice')).toBeTruthy();
    expect(rendered.getByText(/Saved on this device\. Sync pending\./i)).toBeTruthy();
  });

  it('shows all-synced notice when queued count is zero', async () => {
    mockParams = {
      totalCount: '4',
      syncedCount: '4',
      queuedCount: '0',
    };

    const rendered = await render(<ReviewResultScreen />);

    expect(rendered.getByTestId('all-synced-notice')).toBeTruthy();
    expect(rendered.queryByTestId('sync-pending-notice')).toBeNull();
  });

  it('navigates back to lessons when back button is pressed', async () => {
    const rendered = await render(<ReviewResultScreen />);

    fireEvent.press(rendered.getByTestId('back-to-lessons-btn'));

    expect(mockReplace).toHaveBeenCalledWith('/(app)/lessons');
  });

  it('navigates to sync status when view sync status is pressed', async () => {
    const rendered = await render(<ReviewResultScreen />);

    fireEvent.press(rendered.getByTestId('view-sync-status-btn'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/sync-status');
  });
});
