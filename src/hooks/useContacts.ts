import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, setDoc, getDocs, serverTimestamp, limit,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { SavedContact } from '@/src/types';

export function useContacts() {
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const q = query(contactsRef, orderBy('lastUsed', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as SavedContact));
      setContacts(data);
      setLoading(false);
    }, (err) => {
      console.error('Error reading contacts:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const saveContact = async (contact: Omit<SavedContact, 'lastUsed'>) => {
    const user = auth.currentUser;
    if (!user) return;

    const contactRef = doc(db, 'users', user.uid, 'contacts', contact.uid);
    await setDoc(contactRef, {
      email: contact.email,
      displayName: contact.displayName,
      photoURL: contact.photoURL,
      lastUsed: serverTimestamp(),
    }, { merge: true });
  };

  const saveMultipleContacts = async (contactsList: Omit<SavedContact, 'lastUsed'>[]) => {
    for (const contact of contactsList) {
      await saveContact(contact);
    }
  };

  const searchUserByEmail = async (email: string): Promise<SavedContact | null> => {
    if (!email || !email.includes('@')) return null;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      uid: docSnap.id,
      email: data.email || '',
      displayName: data.displayName || '',
      photoURL: data.photoURL || '',
      lastUsed: null,
    };
  };

  return { contacts, loading, saveContact, saveMultipleContacts, searchUserByEmail };
}
