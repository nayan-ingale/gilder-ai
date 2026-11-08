import { describe, expect, it } from 'vitest';
import { type ChatSummary, groupChats } from './chats';

const now = new Date(2026, 10, 9, 15, 0); // 9 Nov 2026, 15:00 local time

function chat(id: string, lastMessageAt: Date, pinned = false): ChatSummary {
  return {
    id,
    title: id,
    pinned,
    lastMessageAt: lastMessageAt.toISOString(),
    createdAt: lastMessageAt.toISOString(),
  };
}

describe('groupChats', () => {
  it('splits chats into Pinned, Today, Previous 7 days and Older, keeping their order', () => {
    const groups = groupChats(
      [
        chat('pinned-old', new Date(2025, 0, 1), true),
        chat('this-morning', new Date(2026, 10, 9, 0, 5)),
        chat('just-before-midnight', new Date(2026, 10, 8, 23, 59)),
        chat('six-days', new Date(2026, 10, 3, 12)),
        chat('eight-days', new Date(2026, 10, 1, 12)),
      ],
      now,
    );

    expect(groups.map((group) => [group.label, group.chats.map((item) => item.id)])).toEqual([
      ['Pinned', ['pinned-old']],
      ['Today', ['this-morning']],
      ['Previous 7 days', ['just-before-midnight', 'six-days']],
      ['Older', ['eight-days']],
    ]);
  });

  it('leaves out empty groups and repeats of a chat', () => {
    const today = chat('a', new Date(2026, 10, 9, 9));

    expect(groupChats([today, today], now)).toEqual([{ label: 'Today', chats: [today] }]);
    expect(groupChats([], now)).toEqual([]);
  });
});
