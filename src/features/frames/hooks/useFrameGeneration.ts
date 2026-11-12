import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useBackends } from '@/features/runtime';
import { frameDescriptionProblem } from '@/shared/lib/frames';
import { errorField, errorMessage } from '@/shared/lib/errors';
import { notifyInfo } from '@/shared/ui';
import { drawingBackends } from '../model/generation';
import { cancelFrameGeneration, generateFrame } from '../store';
import { t } from '../i18n';

export interface GenerationProblems {
  description?: string;
  form?: string;
}

const DESCRIPTION_PROBLEMS = { empty: 'descriptionEmpty', tooLong: 'descriptionTooLong' } as const;

/**
 * 枠の生成のダイアログの状態。描くのは、枠の生成を申告していて status が ready のバックエンドの先頭（選ばせない。ID では分岐しない）。
 * 生成中に閉じると取り消す（取り消しの失敗は知らせない）
 */
export function useFrameGeneration(onClose: () => void, onGenerated: (frameId: string) => void) {
  const backend = drawingBackends(useBackends())[0] ?? null;
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [problems, setProblems] = useState<GenerationProblems>({});
  const cancelled = useRef(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // このダイアログは編集画面・プロフィールのフォームの中に描かれるので、送信を外のフォームへ伝えない
    event.stopPropagation();
    if (backend === null) return;
    const problem = frameDescriptionProblem(description);
    if (problem) {
      setProblems({ description: t(DESCRIPTION_PROBLEMS[problem]) });
      return;
    }
    setProblems({});
    setPending(true);
    cancelled.current = false;
    generateFrame(backend.id, description, name).then(
      (frame) => {
        notifyInfo(t('generated', { name: frame.name }));
        onGenerated(frame.id);
      },
      (error: unknown) => {
        setPending(false);
        if (cancelled.current) return;
        setProblems(
          errorField(error) === 'description' ? { description: errorMessage(error) } : { form: errorMessage(error) },
        );
      },
    );
  };

  const close = () => {
    if (pending) {
      cancelled.current = true;
      void cancelFrameGeneration().catch(() => undefined);
    }
    onClose();
  };

  return {
    backend,
    description,
    setDescription,
    name,
    setName,
    pending,
    problems,
    submit,
    close,
  };
}
