import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '@/src/types';

export type UndoActionType = 'create' | 'update' | 'delete' | 'delete-series' | 'toggle-complete' | 'create-multiple';

export interface UndoAction {
  type: UndoActionType;
  label: string;
  createdIds?: string[];
  taskId?: string;
  previousData?: Partial<Task>;
  fullTaskData?: Omit<Task, 'id'> & { id: string };
  fullTasksData?: { id: string; data: Omit<Task, 'id'> }[];
  previousCompleted?: boolean;
  timestamp: number;
}

const MAX_UNDO_STACK = 30;
const UNDO_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface UseUndoOptions {
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  restoreTask: (data: Omit<Task, 'id'>, id?: string) => Promise<void>;
  restoreMultipleTasks: (tasks: { id: string; data: Omit<Task, 'id'> }[]) => Promise<void>;
  toggleComplete: (id: string, current: boolean) => Promise<void>;
}

export function useUndo(options: UseUndoOptions) {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pushUndo = useCallback((action: Omit<UndoAction, 'timestamp'>) => {
    setUndoStack(prev => {
      const now = Date.now();
      const filtered = prev.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
      return [...filtered, { ...action, timestamp: now }].slice(-MAX_UNDO_STACK);
    });
  }, []);

  const executeUndo = useCallback(async () => {
    setUndoStack(prev => {
      const now = Date.now();
      const valid = prev.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
      if (valid.length === 0) return prev;

      const action = valid[valid.length - 1];
      const remaining = valid.slice(0, -1);

      setIsUndoing(true);

      (async () => {
        try {
          const ops = optionsRef.current;
          switch (action.type) {
            case 'create':
              if (action.createdIds) {
                for (const id of action.createdIds) {
                  await ops.deleteTask(id);
                }
              }
              break;

            case 'create-multiple':
              if (action.createdIds) {
                for (const id of action.createdIds) {
                  await ops.deleteTask(id);
                }
              }
              break;

            case 'update':
              if (action.taskId && action.previousData) {
                await ops.updateTask(action.taskId, action.previousData);
              }
              break;

            case 'delete':
              if (action.fullTaskData) {
                const { id, ...data } = action.fullTaskData;
                await ops.restoreTask(data, id);
              }
              break;

            case 'delete-series':
              if (action.fullTasksData && action.fullTasksData.length > 0) {
                await ops.restoreMultipleTasks(action.fullTasksData);
              }
              break;

            case 'toggle-complete':
              if (action.taskId && action.previousCompleted !== undefined) {
                await ops.toggleComplete(action.taskId, !action.previousCompleted);
              }
              break;
          }
          setToastMessage(`Deshecho: ${action.label}`);
        } catch (err) {
          console.error('Error al deshacer:', err);
          setToastMessage('Error al deshacer la acción');
        } finally {
          setIsUndoing(false);
        }
      })();

      return remaining;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) return;

        e.preventDefault();
        executeUndo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executeUndo]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return {
    pushUndo,
    executeUndo,
    canUndo: undoStack.filter(a => Date.now() - a.timestamp < UNDO_EXPIRY_MS).length > 0,
    toastMessage,
    dismissToast: () => setToastMessage(null),
    isUndoing,
  };
}
