import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { UserSettings, DEFAULT_SETTINGS } from '@/src/types';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);

    ensureUserProfile(user);

    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          workStartTime: data.workStartTime ?? DEFAULT_SETTINGS.workStartTime,
          workEndTime: data.workEndTime ?? DEFAULT_SETTINGS.workEndTime,
          workDays: data.workDays ?? DEFAULT_SETTINGS.workDays,
        });
      }
      setLoading(false);
    }, (err) => {
      console.error('Error reading user settings:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const saveSettings = async (newSettings: UserSettings) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      await updateDoc(userRef, { ...newSettings });
    } else {
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: 'user',
        ...newSettings,
      });
    }
  };

  return { settings, saveSettings, loading };
}

async function ensureUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const updates: Record<string, string> = {};
      if (user.displayName && data.displayName !== user.displayName) {
        updates.displayName = user.displayName;
      }
      if (user.photoURL && data.photoURL !== user.photoURL) {
        updates.photoURL = user.photoURL;
      }
      if (!data.email && user.email) {
        updates.email = user.email;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }
    } else {
      await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: 'user',
        ...DEFAULT_SETTINGS,
      });
    }
  } catch (err) {
    console.error('Error ensuring user profile:', err);
  }
}
