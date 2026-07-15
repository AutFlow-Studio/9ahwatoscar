import React, { createContext, useContext, useEffect, useState } from "react";

export interface UserProfile {
  name: string;
  email: string;
}

type UserProfileProviderProps = {
  children: React.ReactNode;
  defaultProfile?: UserProfile;
  storageKey?: string;
};

type UserProfileProviderState = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
};

const DEFAULT_PROFILE: UserProfile = {
  name: "Alex Summers",
  email: "alex@autflowstudio.com",
};

const UserProfileProviderContext = createContext<
  UserProfileProviderState | undefined
>(undefined);

function loadProfile(storageKey: string, fallback: UserProfile): UserProfile {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function UserProfileProvider({
  children,
  defaultProfile = DEFAULT_PROFILE,
  storageKey = "autflow-studio-user-profile",
  ...props
}: UserProfileProviderProps) {
  const [profile, setProfileState] = useState<UserProfile>(() =>
    loadProfile(storageKey, defaultProfile),
  );

  // Keep in sync if the profile is updated from another tab/window.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setProfileState(loadProfile(storageKey, defaultProfile));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey, defaultProfile]);

  const value: UserProfileProviderState = {
    profile,
    setProfile: (next: UserProfile) => {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setProfileState(next);
    },
  };

  return (
    <UserProfileProviderContext.Provider {...props} value={value}>
      {children}
    </UserProfileProviderContext.Provider>
  );
}

export const useUserProfile = () => {
  const context = useContext(UserProfileProviderContext);

  if (context === undefined)
    throw new Error("useUserProfile must be used within a UserProfileProvider");

  return context;
};
