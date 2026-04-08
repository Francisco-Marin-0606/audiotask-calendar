import { motion, AnimatePresence } from 'motion/react';
import { Undo2, X } from 'lucide-react';

interface UndoToastProps {
  message: string | null;
  onDismiss: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export function UndoToast({ message, onDismiss, onUndo, canUndo }: UndoToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-foreground text-background px-4 py-3 rounded-xl shadow-2xl min-w-[280px] max-w-[420px]"
        >
          <Undo2 size={16} className="shrink-0 opacity-70" />
          <span className="text-sm font-medium flex-1 truncate">{message}</span>
          {canUndo && (
            <button
              onClick={onUndo}
              className="text-xs font-bold uppercase tracking-wide text-primary hover:opacity-80 transition-opacity shrink-0 px-2 py-1 rounded-md hover:bg-background/10"
            >
              Deshacer
            </button>
          )}
          <button
            onClick={onDismiss}
            className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
