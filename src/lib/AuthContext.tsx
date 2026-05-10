import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';

export type UserRole = 'ADMIN' | 'TEKNISYEN' | 'CAGRI_MERKEZI';

export interface UserProfile {
  role?: UserRole;
  email?: string | null;
  name?: string | null;
  createdAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: loginWithGoogle,
  logout: logout,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const userRef = doc(db, 'users', authUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
             setProfile(userSnap.data() as UserProfile);
          } else {
             const newProfile: UserProfile = {
               email: authUser.email,
               name: authUser.displayName,
               role: 'ADMIN', // Defaulting to ADMIN for safety currently, this can be manually changed in db
               createdAt: serverTimestamp()
             };
             await setDoc(userRef, newProfile);
             setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login: loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
