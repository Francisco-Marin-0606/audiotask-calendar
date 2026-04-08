import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Trash2, Check, XCircle, Bot, User as UserIcon, Calendar, Clock, Pencil, Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { useChatAssistant } from '@/src/hooks/useChatAssistant';
import { Task, UserSettings, ProposedTask, ChatMessage, TaskType, RecurrenceConfig } from '@/src/types';
import type { User } from 'firebase/auth';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatAssistantProps {
  tasks: Task[];
  settings: UserSettings;
  user: User;
  onAddTasks: (tasks: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'>[]) => Promise<void>;
  onAddTask: (task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'> & { recurrence?: RecurrenceConfig }) => Promise<void>;
  onPreviewTasks: (tasks: ProposedTask[]) => void;
}

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'audiovisual', label: 'Audiovisual' },
  { value: 'personal', label: 'Personal' },
  { value: 'admin', label: 'Admin' },
];

const TYPE_COLORS: Record<string, string> = {
  audiovisual: 'bg-purple-500/20 text-purple-300',
  personal: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-amber-500/20 text-amber-300',
};

function formatDateShort(dateStr: string) {
  try {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    return format(d, "EEE d 'de' MMM", { locale: es });
  } catch {
    return dateStr;
  }
}

function EditableTaskCard({
  task,
  index,
  isPending,
  onUpdate,
}: {
  task: ProposedTask;
  index: number;
  isPending: boolean;
  onUpdate: (index: number, updated: ProposedTask) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task);

  useEffect(() => { setDraft(task); }, [task]);

  const save = () => {
    onUpdate(index, draft);
    setEditing(false);
  };

  if (editing && isPending) {
    return (
      <div className="rounded-md bg-white/5 border border-violet-500/30 p-2.5 space-y-2">
        <input
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500/50"
          placeholder="Título"
        />
        <input
          value={draft.description}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-violet-500/50"
          placeholder="Descripción"
        />
        <div className="grid grid-cols-3 gap-1.5">
          <input
            type="date"
            value={draft.date}
            onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
            className="bg-white/10 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
          />
          <input
            type="time"
            value={draft.startTime}
            onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))}
            className="bg-white/10 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
          />
          <input
            type="time"
            value={draft.endTime}
            onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))}
            className="bg-white/10 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={draft.type}
            onChange={e => setDraft(d => ({ ...d, type: e.target.value as TaskType }))}
            className="bg-white/10 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-violet-500/50 flex-1"
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
            ))}
          </select>
          <Button size="xs" onClick={save} className="bg-violet-600 hover:bg-violet-700 text-white text-[11px]">
            <Check className="size-3 mr-0.5" /> Listo
          </Button>
          <Button size="xs" variant="ghost" onClick={() => { setDraft(task); setEditing(false); }} className="text-white/50 hover:text-white text-[11px]">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white/5 border border-white/5 p-2.5 space-y-1 group/card">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-white/90 flex-1 truncate">{task.title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[task.type] || TYPE_COLORS.personal}`}>
          {task.type}
        </span>
        {isPending && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/card:opacity-100 transition-opacity text-white/40 hover:text-white p-0.5"
            title="Editar tarea"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-white/50">{task.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {formatDateShort(task.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {task.startTime} – {task.endTime}
        </span>
      </div>
      {task.recurrence && (
        <div className="flex items-center gap-1 text-[11px] text-violet-400">
          <Repeat className="size-3" />
          <span>
            {task.recurrence.count} veces
            {task.recurrence.interval > 1 ? `, cada ${task.recurrence.interval} días` : ', diario'}
          </span>
        </div>
      )}
    </div>
  );
}

function TaskProposalCard({
  proposals,
  messageId,
  status,
  onAccept,
  onReject,
  onUpdateProposal,
}: {
  proposals: ProposedTask[];
  messageId: string;
  status?: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
  onUpdateProposal: (index: number, updated: ProposedTask) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const showCollapse = proposals.length > 4;

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-white/60">
        <Calendar className="size-3.5" />
        <span className="flex-1">Tareas propuestas ({proposals.length})</span>
        {showCollapse && (
          <button onClick={() => setCollapsed(c => !c)} className="text-white/40 hover:text-white">
            {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
        )}
      </div>

      <div className={`space-y-2 ${collapsed ? 'max-h-[180px] overflow-hidden' : ''}`}>
        {proposals.map((task, i) => (
          <EditableTaskCard
            key={`${messageId}-${i}`}
            task={task}
            index={i}
            isPending={status === 'pending'}
            onUpdate={onUpdateProposal}
          />
        ))}
      </div>
      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="text-[11px] text-violet-400 hover:text-violet-300">
          Ver todas ({proposals.length})
        </button>
      )}

      {status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={onAccept}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Check className="size-3.5 mr-1" />
            Agregar al calendario
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReject}
            className="flex-1 text-white/60 hover:text-white hover:bg-white/10 text-xs"
          >
            <XCircle className="size-3.5 mr-1" />
            Descartar
          </Button>
        </div>
      )}

      {status === 'accepted' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 pt-1">
          <Check className="size-3.5" />
          Tareas agregadas al calendario
        </div>
      )}

      {status === 'rejected' && (
        <div className="flex items-center gap-1.5 text-xs text-white/40 pt-1">
          <XCircle className="size-3.5" />
          Propuesta descartada
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  onAcceptProposal,
  onRejectProposal,
  onUpdateProposal,
}: {
  message: ChatMessage;
  onAcceptProposal: () => void;
  onRejectProposal: () => void;
  onUpdateProposal: (index: number, updated: ProposedTask) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 size-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-violet-600 to-fuchsia-500'
      }`}>
        {isUser ? <UserIcon className="size-3.5 text-white" /> : <Bot className="size-3.5 text-white" />}
      </div>
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white/10 text-white/90 rounded-bl-md'
        }`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white">
              <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
            </div>
          )}
        </div>
        {message.proposals && message.proposals.length > 0 && (
          <TaskProposalCard
            proposals={message.proposals}
            messageId={message.id}
            status={message.proposalStatus}
            onAccept={onAcceptProposal}
            onReject={onRejectProposal}
            onUpdateProposal={onUpdateProposal}
          />
        )}
      </div>
    </div>
  );
}

export function ChatAssistant({ tasks, settings, user, onAddTasks, onAddTask, onPreviewTasks }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userName = user.displayName || user.email?.split('@')[0] || 'Usuario';

  const {
    messages,
    isLoading,
    sendMessage,
    updateProposalStatus,
    updateProposal,
    clearChat,
  } = useChatAssistant(tasks, settings, userName);

  // Sync preview tasks: collect all pending proposals
  useEffect(() => {
    const pending: ProposedTask[] = [];
    for (const m of messages) {
      if (m.proposals && m.proposalStatus === 'pending') {
        pending.push(...m.proposals);
      }
    }
    onPreviewTasks(pending);
  }, [messages, onPreviewTasks]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcceptProposal = async (msg: ChatMessage) => {
    if (!msg.proposals || msg.proposalStatus !== 'pending') return;

    try {
      for (const p of msg.proposals) {
        if (p.recurrence && p.recurrence.count > 1) {
          await onAddTask({
            title: p.title,
            description: p.description,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            type: p.type,
            attachments: [],
            recurrence: p.recurrence,
          });
        } else {
          await onAddTasks([{
            title: p.title,
            description: p.description,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            type: p.type,
            attachments: [],
          }]);
        }
      }
      updateProposalStatus(msg.id, 'accepted');
      sendMessage('Las tareas fueron agregadas exitosamente al calendario.');
    } catch {
      // keep pending so user can retry
    }
  };

  const handleRejectProposal = (msg: ChatMessage) => {
    updateProposalStatus(msg.id, 'rejected');
  };

  const handleClear = useCallback(() => {
    clearChat();
    onPreviewTasks([]);
  }, [clearChat, onPreviewTasks]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-[380px] max-h-[600px] rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-violet-600/20 to-fuchsia-500/20">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
                  <Bot className="size-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">TaskBot</h3>
                  <p className="text-[11px] text-white/50">Asistente de planificación</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClear}
                  className="text-white/40 hover:text-white hover:bg-white/10"
                  title="Limpiar chat"
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setIsOpen(false)}
                  className="text-white/40 hover:text-white hover:bg-white/10"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '440px' }}>
              <div className="p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <div className="size-12 mx-auto rounded-full bg-gradient-to-br from-violet-600/30 to-fuchsia-500/30 flex items-center justify-center">
                      <Bot className="size-6 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">¡Hola {userName}!</p>
                      <p className="text-xs text-white/40 mt-1 max-w-[250px] mx-auto">
                        Soy TaskBot, tu asistente de planificación. Contame qué tenés que hacer y te ayudo a organizarlo.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                      {[
                        'Organizame el día',
                        'Quiero grabar un tema',
                        '¿Qué tengo pendiente?',
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setInput(suggestion);
                            sendMessage(suggestion);
                          }}
                          className="text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    onAcceptProposal={() => handleAcceptProposal(msg)}
                    onRejectProposal={() => handleRejectProposal(msg)}
                    onUpdateProposal={(idx, updated) => updateProposal(msg.id, idx, updated)}
                  />
                ))}

                {isLoading && messages.length > 0 && !messages[messages.length - 1]?.content && (
                  <div className="flex gap-2">
                    <div className="size-7 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="size-3.5 text-white" />
                    </div>
                    <div className="bg-white/10 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                      <div className="flex gap-1">
                        <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribí tu mensaje..."
                  rows={1}
                  className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 max-h-24"
                  style={{ minHeight: '38px' }}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 text-white rounded-xl shrink-0 disabled:opacity-30"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-50 size-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 flex items-center justify-center hover:shadow-violet-500/40 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="size-5" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="size-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
