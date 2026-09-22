import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../../../app/(auth)/login';
import '../../i18n';

// Mock useAuth
const mockLogin = jest.fn();
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe('LoginScreen Error Handling and Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders human-readable error without crashing when FastAPI returns 422 validation error array', async () => {
    // Simulate ApiError thrown when FastAPI returns 422
    const pydanticError = {
      name: 'ApiError',
      status: 422,
      data: {
        detail: [
          {
            type: 'value_error',
            loc: ['body', 'email'],
            msg: 'value is not a valid email address: An email address must have an @-sign.',
            input: 'P001',
            ctx: { reason: 'An email address must have an @-sign.' },
          },
        ],
      },
    };

    mockLogin.mockRejectedValueOnce(pydanticError);

    const rendered = await render(<LoginScreen />);
    const emailInput = rendered.getByPlaceholderText(/learner@example.com/i);
    const passwordInput = rendered.getByPlaceholderText(/Enter password/i);
    const submitBtn = rendered.getByText(/Sign In/i);

    await act(async () => {
      fireEvent.changeText(emailInput, 'P001');
    });
    await act(async () => {
      fireEvent.changeText(passwordInput, 'temporary_pass');
    });
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    // Renders the normalized validation string safely without crashing
    expect(rendered.getByText(/value is not a valid email address/i)).toBeTruthy();
  });

  it('successful temporary-password login completes login call for routing to change-password', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    const rendered = await render(<LoginScreen />);
    const emailInput = rendered.getByPlaceholderText(/learner@example.com/i);
    const passwordInput = rendered.getByPlaceholderText(/Enter password/i);
    const submitBtn = rendered.getByText(/Sign In/i);

    await act(async () => {
      fireEvent.changeText(emailInput, 'dev_learner@example.com');
    });
    await act(async () => {
      fireEvent.changeText(passwordInput, 'TempPass123!');
    });
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(mockLogin).toHaveBeenCalledWith('dev_learner@example.com', 'TempPass123!');
  });
});
