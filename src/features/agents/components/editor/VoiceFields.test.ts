// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyLanguage } from '@/shared/i18n';
import { DEFAULT_VOICE } from '@/shared/lib/voice';
import type { VoiceSettings } from '@/shared/types/domain';
import { VoiceFields } from './VoiceFields';

function Editor() {
  const [value, onChange] = useState<VoiceSettings>({ ...DEFAULT_VOICE });
  return createElement(VoiceFields, { value, onChange });
}

beforeEach(() => applyLanguage('ja'));
afterEach(cleanup);

describe('会話文体の編集欄', () => {
  it('自動と通常を切り替え、強度を変えられる', () => {
    render(createElement(Editor));
    expect(screen.getByLabelText<HTMLSelectElement>('会話の文体').options).toHaveLength(2);
    expect(document.querySelector('datalist')).toBeNull();
    fireEvent.change(screen.getByLabelText('表現の強さ'), { target: { value: 'strong' } });
    expect(screen.getByLabelText<HTMLSelectElement>('表現の強さ').value).toBe('strong');
    fireEvent.change(screen.getByLabelText('会話の文体'), { target: { value: 'off' } });
    expect(screen.queryByLabelText('表現の強さ')).toBeNull();
  });
  it('旧保存値は自動と表示する', () => {
    render(
      createElement(VoiceFields, {
        value: { mode: '045', intensity: 'weak' },
        onChange: () => undefined,
      }),
    );
    expect(screen.getByLabelText<HTMLSelectElement>('会話の文体').value).toBe('auto');
  });
});
