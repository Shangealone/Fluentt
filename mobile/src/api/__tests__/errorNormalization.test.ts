import {
  ApiError,
  AuthenticationError,
  getApiErrorMessage,
  normalizeApiErrorMessage,
} from '../client';

describe('API Error Normalization', () => {
  it('normalizes FastAPI/Pydantic 422 validation error array into readable string', () => {
    const pydanticDetail = [
      {
        type: 'value_error',
        loc: ['body', 'email'],
        msg: 'value is not a valid email address: An email address must have an @-sign.',
        input: 'P001',
        ctx: { reason: 'An email address must have an @-sign.' },
      },
    ];

    const message = normalizeApiErrorMessage({ detail: pydanticDetail }, 422);
    expect(message).toBe(
      'value is not a valid email address: An email address must have an @-sign.'
    );
    expect(typeof message).toBe('string');
  });

  it('normalizes multiple validation errors into a joined string', () => {
    const pydanticDetails = [
      { loc: ['body', 'email'], msg: 'Field required', type: 'missing' },
      { loc: ['body', 'password'], msg: 'Password is too short', type: 'value_error' },
    ];

    const message = normalizeApiErrorMessage({ detail: pydanticDetails }, 422);
    expect(message).toBe('Field required. Password is too short');
  });

  it('normalizes standard string detail from HTTPException', () => {
    const message = normalizeApiErrorMessage({ detail: 'Invalid email or password' }, 401);
    expect(message).toBe('Invalid email or password');
  });

  it('normalizes generic object with message property', () => {
    const message = normalizeApiErrorMessage({ message: 'Internal server error' }, 500);
    expect(message).toBe('Internal server error');
  });

  it('normalizes string response body', () => {
    const message = normalizeApiErrorMessage('Bad Gateway', 502);
    expect(message).toBe('Bad Gateway');
  });

  it('falls back to status code message when data is empty or undefined', () => {
    expect(normalizeApiErrorMessage(null, 500)).toBe('Request failed with status 500');
    expect(normalizeApiErrorMessage({}, 404)).toBe('Request failed with status 404');
  });

  it('ApiError constructor automatically normalizes error message into string', () => {
    const err = new ApiError(422, {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'email'],
          msg: 'value is not a valid email address',
          input: 'invalid',
          ctx: {},
        },
      ],
    });

    expect(err.message).toBe('value is not a valid email address');
    expect(err.normalizedMessage).toBe('value is not a valid email address');
  });

  it('getApiErrorMessage safely extracts render-safe string from any error type', () => {
    const apiErr = new ApiError(422, {
      detail: [{ type: 'missing', loc: ['body'], msg: 'Field required' }],
    });
    expect(getApiErrorMessage(apiErr, 'Fallback')).toBe('Field required');

    const authErr = new AuthenticationError(401, { detail: 'Session expired' });
    expect(getApiErrorMessage(authErr, 'Fallback')).toBe('Session expired');

    const standardErr = new Error('Network timeout');
    expect(getApiErrorMessage(standardErr, 'Fallback')).toBe('Network timeout');

    const unknownErr = { foo: 'bar' };
    expect(getApiErrorMessage(unknownErr, 'Fallback')).toBe('Fallback');
  });
});
