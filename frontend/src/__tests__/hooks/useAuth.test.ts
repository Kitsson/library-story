import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
  },
  api: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockLogin = authApi.login as ReturnType<typeof vi.fn>;
const mockRegister = authApi.register as ReturnType<typeof vi.fn>;
const mockMe = authApi.me as ReturnType<typeof vi.fn>;

const fakeUser = {
  id: 'user-1',
  email: 'anna@firma.se',
  firstName: 'Anna',
  lastName: 'Svensson',
  role: 'ADMIN',
  organizationId: 'org-1',
};

const fakeOrg = {
  id: 'org-1',
  name: 'Firma AB',
  tier: 'KLARSTART',
  maxUsers: 3,
  maxClients: 10,
};

const fakeTokens = {
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
};

function resetStore() {
  useAuth.setState({
    user: null,
    organization: null,
    isLoading: true,
    isAuthenticated: false,
  });
}

describe('useAuth - login', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('sets user and organization in store after successful login', async () => {
    mockLogin.mockResolvedValueOnce({
      data: { user: fakeUser, organization: fakeOrg, tokens: fakeTokens },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('anna@firma.se', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.organization).toEqual(fakeOrg);
  });

  test('stores tokens in localStorage after successful login', async () => {
    mockLogin.mockResolvedValueOnce({
      data: { user: fakeUser, organization: fakeOrg, tokens: fakeTokens },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('anna@firma.se', 'password123');
    });

    expect(localStorage.getItem('accessToken')).toBe('fake-access-token');
    expect(localStorage.getItem('refreshToken')).toBe('fake-refresh-token');
  });

  test('propagates error when login API call fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.login('anna@firma.se', 'wrongpassword');
      })
    ).rejects.toThrow('Invalid credentials');

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  test('calls authApi.login with the correct credentials', async () => {
    mockLogin.mockResolvedValueOnce({
      data: { user: fakeUser, organization: fakeOrg, tokens: fakeTokens },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('anna@firma.se', 'SuperSecret1234!');
    });

    expect(mockLogin).toHaveBeenCalledOnce();
    expect(mockLogin).toHaveBeenCalledWith('anna@firma.se', 'SuperSecret1234!');
  });
});

describe('useAuth - logout', () => {
  beforeEach(() => {
    useAuth.setState({
      user: fakeUser,
      organization: fakeOrg,
      isLoading: false,
      isAuthenticated: true,
    });
    localStorage.setItem('accessToken', 'fake-access-token');
    localStorage.setItem('refreshToken', 'fake-refresh-token');
  });

  test('clears user and organization from store', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.organization).toBeNull();
  });

  test('removes tokens from localStorage', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

describe('useAuth - loadUser', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  test('populates store when /me returns a valid user', async () => {
    mockMe.mockResolvedValueOnce({
      data: { user: fakeUser, organization: fakeOrg },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.loadUser();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.isLoading).toBe(false);
  });

  test('sets isLoading false and isAuthenticated false when /me fails', async () => {
    mockMe.mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.loadUser();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
