import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Task, TaskType, Attachment, RecurrenceConfig } from '@/src/types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error(`🔥 Firestore Error [${operationType}] ${path}:`, error);
  console.error('Details:', JSON.stringify(errInfo, null, 2));
  return errInfo;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Task[];
      tasksData.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      setTasks(tasksData);
      setLoading(false);
      setError(null);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tasks');
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const addTask = async (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'> & { recurrence?: RecurrenceConfig }) => {
    if (!auth.currentUser) throw new Error('No authenticated user');

    const { recurrence, ...baseTaskData } = taskData;

    if (recurrence && recurrence.count > 1) {
      const seriesId = crypto.randomUUID();
      const batch = writeBatch(db);
      const tasksRef = collection(db, 'tasks');

      for (let i = 0; i < recurrence.count; i++) {
        const baseDate = new Date(baseTaskData.date + 'T00:00:00');
        baseDate.setDate(baseDate.getDate() + i * recurrence.interval);
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
        const dd = String(baseDate.getDate()).padStart(2, '0');

        const docData = {
          ...baseTaskData,
          date: `${yyyy}-${mm}-${dd}`,
          completed: false,
          userId: auth.currentUser.uid,
          ownerDisplayName: auth.currentUser.displayName || '',
          ownerPhotoURL: auth.currentUser.photoURL || '',
          createdAt: serverTimestamp(),
          seriesId,
          recurrenceIndex: i,
          recurrenceTotal: recurrence.count,
        };

        const newDocRef = doc(tasksRef);
        batch.set(newDocRef, docData);
      }

      console.log(`📝 Creating ${recurrence.count} recurring tasks (series: ${seriesId})`);
      try {
        const timeoutMs = 15000;
        await Promise.race([
          batch.commit(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(
              'Timeout: Firestore no respondió. Verificá que Cloud Firestore esté habilitado.'
            )), timeoutMs)
          )
        ]);
        console.log(`✅ ${recurrence.count} recurring tasks created successfully`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tasks (batch)');
        throw err;
      }
    } else {
      const docData = {
        ...baseTaskData,
        completed: false,
        userId: auth.currentUser.uid,
        ownerDisplayName: auth.currentUser.displayName || '',
        ownerPhotoURL: auth.currentUser.photoURL || '',
        createdAt: serverTimestamp()
      };
      console.log('📝 Creating task:', JSON.stringify(docData, null, 2));
      try {
        const timeoutMs = 10000;
        const result = await Promise.race([
          addDoc(collection(db, 'tasks'), docData),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(
              'Timeout: Firestore no respondió en 10s. Verificá que Cloud Firestore esté habilitado en Firebase Console (no Realtime Database).'
            )), timeoutMs)
          )
        ]);
        console.log('✅ Task created successfully:', result.id);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tasks');
        throw err;
      }
    }
  };

  const updateTask = async (id: string, taskData: Partial<Task>) => {
    try {
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, taskData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const deleteTaskSeries = async (seriesId: string) => {
    const seriesTasks = tasks.filter(t => t.seriesId === seriesId);
    if (seriesTasks.length === 0) return;

    const batch = writeBatch(db);
    for (const task of seriesTasks) {
      batch.delete(doc(db, 'tasks', task.id));
    }

    console.log(`🗑️ Deleting ${seriesTasks.length} tasks from series ${seriesId}`);
    try {
      await batch.commit();
      console.log(`✅ Series deleted successfully`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks (series: ${seriesId})`);
    }
  };

  const toggleComplete = async (id: string, currentValue: boolean) => {
    try {
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, { completed: !currentValue });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const addMultipleTasks = async (tasksData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'>[]) => {
    if (!auth.currentUser) throw new Error('No authenticated user');

    const batch = writeBatch(db);
    const tasksRef = collection(db, 'tasks');

    for (const taskData of tasksData) {
      const docData = {
        ...taskData,
        completed: false,
        userId: auth.currentUser.uid,
        ownerDisplayName: auth.currentUser.displayName || '',
        ownerPhotoURL: auth.currentUser.photoURL || '',
        createdAt: serverTimestamp(),
      };
      const newDocRef = doc(tasksRef);
      batch.set(newDocRef, docData);
    }

    console.log(`📝 Creating ${tasksData.length} theme tasks`);
    try {
      const timeoutMs = 15000;
      await Promise.race([
        batch.commit(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(
            'Timeout: Firestore no respondió. Verificá que Cloud Firestore esté habilitado.'
          )), timeoutMs)
        )
      ]);
      console.log(`✅ ${tasksData.length} theme tasks created successfully`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks (theme batch)');
      throw err;
    }
  };

  return { tasks, loading, error, addTask, addMultipleTasks, updateTask, deleteTask, deleteTaskSeries, toggleComplete };
}
