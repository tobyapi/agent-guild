import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useBackends } from '@/features/runtime';
import { Button, ConfirmDialog, Icon, IconButton, reportError } from '@/shared/ui';
import { useFrameChoices } from '../hooks/useFrames';
import { offersFrameGeneration } from '../model/generation';
import type { FrameChoice } from '../model/catalog';
import { removeFrame } from '../store';
import { FrameTile } from './FrameTile';
import { GenerateFrameDialog } from './GenerateFrameDialog';
import { t } from '../i18n';
import styles from './FramePicker.module.css';

export interface FramePickerProps {
  /** 選んでいる枠の ID（'' は枠なし） */
  value: string;
  onChange: (frameId: string) => void;
  /** 見本に使う、いまのアバター */
  avatar: string;
  name: string;
  color: string;
  human?: boolean;
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function caption(choice: FrameChoice | undefined): string {
  return choice?.name ?? '';
}

/** 矢印キーで隣の選択肢を選び、そこへフォーカスを移す（端から反対の端へ回る） */
function moveFocus(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  choices: readonly FrameChoice[],
  onChange: (frameId: string) => void,
): void {
  const step = STEPS[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const next = (index + step + choices.length) % choices.length;
  const choice = choices[next];
  if (!choice) return;
  onChange(choice.id);
  const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[next]?.focus();
}

/**
 * アイコンの枠の選択（ラジオグループ。矢印キーで隣へ移る）。生成した枠は消せる。
 * 枠の生成を申告するバックエンドがあるときだけ、新しい枠を生成できる（なければ生成の操作を出さない）
 */
export function FramePicker({ value, onChange, avatar, name, color, human }: FramePickerProps) {
  const choices = useFrameChoices();
  const [shown, setShown] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FrameChoice | null>(null);
  const [generating, setGenerating] = useState(false);
  const canGenerate = offersFrameGeneration(useBackends());
  // 消えた枠を選んでいたら「なし」が選ばれているように見せる
  const selected = choices.some((choice) => choice.id === value) ? value : '';
  const confirmRemove = (choice: FrameChoice) => {
    setRemoving(null);
    if (value === choice.id) onChange('');
    removeFrame(choice.id).catch(reportError);
  };
  return (
    <div className={styles.picker}>
      <span className={styles.label}>{t('label')}</span>
      <div className={styles.grid} role="radiogroup" aria-label={t('label')} onMouseLeave={() => setShown(null)}>
        {choices.map((choice, index) => (
          <div key={choice.id} className={styles.cell}>
            <FrameTile
              choice={choice}
              title={caption(choice)}
              checked={choice.id === selected}
              avatar={{ avatar, name, color, human }}
              onSelect={() => onChange(choice.id)}
              onKeyDown={(event) => moveFocus(event, index, choices, onChange)}
              onShow={() => setShown(choice.id)}
            />
            {choice.removable && (
              <IconButton
                label={t('remove', { name: choice.name })}
                className={styles.remove}
                onClick={() => setRemoving(choice)}
              >
                <Icon name="close" />
              </IconButton>
            )}
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span className={styles.caption} aria-live="polite">
          {caption(choices.find((choice) => choice.id === (shown ?? selected)))}
        </span>
        {canGenerate && (
          <Button size="sm" onClick={() => setGenerating(true)}>
            {t('generate')}
          </Button>
        )}
      </div>
      {/* 編集画面・プロフィールのフォームの中に置かれるので、生成のフォームは body に出す（form の入れ子を作らない） */}
      {generating &&
        canGenerate &&
        createPortal(
          <GenerateFrameDialog
            onClose={() => setGenerating(false)}
            onGenerated={(frameId) => {
              setGenerating(false);
              onChange(frameId);
            }}
          />,
          document.body,
        )}
      {removing && (
        <ConfirmDialog
          title={t('removeTitle')}
          message={t('removeMessage', { name: removing.name })}
          confirmLabel={t('removeConfirm')}
          danger
          onConfirm={() => confirmRemove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
