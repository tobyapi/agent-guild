// Rust（guild-domain の notices と verdict）と同じ実例で、モックのお知らせの文面が同じになることを検査する。
import { expect, it } from 'vitest';
import { behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import * as notices from './notices';

interface Named {
  name: string;
  text: string;
}
interface Listed {
  names: string[];
  text: string;
}
interface NoticesFixture {
  stopped: string;
  depthLimit: string;
  noResponder: string;
  joined: Named;
  undeliverable: Named;
  didNotAnswer: Named;
  failed: Named;
  unassignable: Listed;
  tooManyTasks: Listed;
  subtaskNotes: Record<string, string>;
}

const expected = behaviorFixture<NoticesFixture>('notices.json');

it('決まった文面は Rust と同じ', () => {
  expect([notices.STOPPED, notices.DEPTH_LIMIT, notices.NO_RESPONDER]).toEqual([
    expected.stopped,
    expected.depthLimit,
    expected.noResponder,
  ]);
  expect(expected.subtaskNotes).toMatchObject(notices.SUBTASK_NOTES);
});

it.each(['joined', 'undeliverable', 'didNotAnswer', 'failed'] as const)('%s の文面は Rust と同じ', (key) => {
  expect(notices[key](expected[key].name)).toBe(expected[key].text);
});

it.each(['unassignable', 'tooManyTasks'] as const)('%s の文面は Rust と同じ', (key) => {
  expect(notices[key](expected[key].names)).toBe(expected[key].text);
});
