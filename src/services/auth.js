import api from "./api";

const TOKEN_KEY = "expenseTrackerToken";
const USER_KEY = "expenseTrackerUser";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

const setSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const login = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  setSession(response.data);
  return response.data;
};

export const register = async (payload) => {
  const response = await api.post("/auth/register", payload);
  setSession(response.data);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isLoggedIn = () => Boolean(getToken());
