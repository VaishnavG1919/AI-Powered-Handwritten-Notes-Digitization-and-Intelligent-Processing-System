import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, login as apiLogin, register as apiRegister, type UserOut } from "./api";

interface AuthContextType {
  user: UserOut | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("hwn_token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("hwn_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await apiLogin(email, password);
    localStorage.setItem("hwn_token", data.access_token);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiRegister(name, email, password);
    localStorage.setItem("hwn_token", data.access_token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("hwn_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
