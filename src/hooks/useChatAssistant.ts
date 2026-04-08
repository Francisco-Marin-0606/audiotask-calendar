import { useState, useRef, useCallback } from 'react';
import { ChatMessage, ProposedTask, Task, UserSettings, RecurrenceConfig, SocialPlatform, SOCIAL_PLATFORMS } from '@/src/types';
import { buildSystemPrompt } from '@/src/lib/chatSystemPrompt';

function extractItems(arr: any[]): ProposedTask[] {
  const validPlatformIds = SOCIAL_PLATFORMS.map(p => p.id);
  const results: ProposedTask[] = [];
  for (const item of arr) {
    if (item.title && item.date && item.startTime && item.endTime) {
      const proposal: ProposedTask = {
        title: item.title,
        description: item.description || '',
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        type: item.type || 'personal',
      };
      if (item.recurrence && item.recurrence.count > 1) {
        proposal.recurrence = {
          type: item.recurrence.type || 'daily',
          interval: item.recurrence.interval || 1,
          count: item.recurrence.count,
        };
      }
      if (item.publishedOn && validPlatformIds.includes(item.publishedOn)) {
        proposal.publishedOn = item.publishedOn as SocialPlatform;
      }
      if (item.themeId) proposal.themeId = item.themeId;
      if (item.themeName) proposal.themeName = item.themeName;
      results.push(proposal);
    }
  }
  return results;
}

function parseProposals(text: string): { cleanText: string; proposals: ProposedTask[] } {
  const proposals: ProposedTask[] = [];
  let cleanText = text;

  const patterns = [
    /\[TASK_PROPOSAL\]\s*([\s\S]*?)\s*\[\/TASK_PROPOSAL\]/g,
    /\[\/TASK_PROPOSAL\]\s*([\s\S]*?)\s*\[\/TASK_PROPOSAL\]/g,
    /\[TASK_PROPOSAL\]\s*([\s\S]*?)\s*\[TASK_PROPOSAL\]/g,
  ];

  let matched = false;
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        proposals.push(...extractItems(arr));
        matched = true;
      } catch {
        // JSON parse failed
      }
      cleanText = cleanText.replace(match[0], '').trim();
    }
    if (matched) break;
  }

  if (!matched) {
    const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*?"title"[\s\S]*?"date"[\s\S]*?"startTime"[\s\S]*?\}\s*\]/);
    if (jsonArrayMatch) {
      try {
        const parsed = JSON.parse(jsonArrayMatch[0]);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const items = extractItems(arr);
        if (items.length > 0) {
          proposals.push(...items);
          cleanText = cleanText.replace(jsonArrayMatch[0], '').trim();
        }
      } catch {
        // fallback parse failed
      }
    }
  }

  cleanText = cleanText
    .replace(/\[\/?TASK_PROPOSAL\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, proposals };
}

export function useChatAssistant(
  tasks: Task[],
  settings: UserSettings,
  userName: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    const systemPrompt = buildSystemPrompt(userName, settings, tasks);

    const historyForApi = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          systemPrompt,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${err.error || 'No se pudo conectar con el asistente'}` }
              : m,
          ),
        );
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);

          try {
            const data = JSON.parse(jsonStr);

            if (data.error) {
              accumulated += `\n\nError: ${data.error}`;
              break;
            }

            if (data.done) break;

            if (data.text) {
              accumulated += data.text;
            }
          } catch {
            // skip malformed JSON
          }
        }

        const { cleanText, proposals } = parseProposals(accumulated);

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: cleanText,
                  proposals: proposals.length > 0 ? proposals : undefined,
                  proposalStatus: proposals.length > 0 ? 'pending' as const : undefined,
                }
              : m,
          ),
        );
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Error: No se pudo conectar con el asistente. Verificá tu conexión.' }
              : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading, tasks, settings, userName]);

  const updateProposalStatus = useCallback(
    (messageId: string, status: 'accepted' | 'rejected') => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, proposalStatus: status } : m,
        ),
      );
    },
    [],
  );

  const updateProposal = useCallback(
    (messageId: string, proposalIndex: number, updated: ProposedTask) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId || !m.proposals) return m;
          const newProposals = [...m.proposals];
          newProposals[proposalIndex] = updated;
          return { ...m, proposals: newProposals };
        }),
      );
    },
    [],
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    updateProposalStatus,
    updateProposal,
    clearChat,
  };
}
