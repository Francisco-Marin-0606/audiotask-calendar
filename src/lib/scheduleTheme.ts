import { Task, UserSettings, THEME_STEPS } from '@/src/types';
import { format, addDays, getDay } from 'date-fns';
import { timeToMinutes, minutesToTime, getFreeBlocks, TimeBlock } from '@/src/lib/timeUtils';

interface ScheduledTask {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'audiovisual';
  themeId: string;
  themeName: string;
  themeOrder: number;
  attachments: [];
}

export function scheduleTheme(
  themeName: string,
  themeId: string,
  existingTasks: Task[],
  settings: UserSettings,
  startDate: Date,
  maxDays = 60,
): ScheduledTask[] {
  const workStart = timeToMinutes(settings.workStartTime);
  const workEnd = timeToMinutes(settings.workEndTime);

  const tasksByDate = new Map<string, TimeBlock[]>();
  for (const t of existingTasks) {
    const blocks = tasksByDate.get(t.date) ?? [];
    blocks.push({ start: timeToMinutes(t.startTime), end: timeToMinutes(t.endTime) });
    tasksByDate.set(t.date, blocks);
  }

  const GAP_MINUTES = 20;
  const scheduled: ScheduledTask[] = [];
  let stepIdx = 0;

  for (let d = 0; d < maxDays && stepIdx < THEME_STEPS.length; d++) {
    const date = addDays(startDate, d);
    const dayOfWeek = getDay(date);

    if (!settings.workDays.includes(dayOfWeek)) continue;

    const dateStr = format(date, 'yyyy-MM-dd');
    const occupied = tasksByDate.get(dateStr) ?? [];
    const freeBlocks = getFreeBlocks(occupied, workStart, workEnd);

    for (const block of freeBlocks) {
      if (stepIdx >= THEME_STEPS.length) break;

      let cursor = block.start;

      while (stepIdx < THEME_STEPS.length && cursor + THEME_STEPS[stepIdx].durationMinutes <= block.end) {
        const step = THEME_STEPS[stepIdx];
        const startMin = cursor;
        const endMin = cursor + step.durationMinutes;

        const task: ScheduledTask = {
          title: `${step.label} — ${themeName}`,
          description: `Paso ${step.order}/${THEME_STEPS.length} del tema "${themeName}"`,
          date: dateStr,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          type: 'audiovisual',
          themeId,
          themeName,
          themeOrder: step.order,
          attachments: [],
        };

        scheduled.push(task);

        occupied.push({ start: startMin, end: endMin });
        tasksByDate.set(dateStr, occupied);

        cursor = endMin + GAP_MINUTES;
        stepIdx++;
      }
    }
  }

  return scheduled;
}
