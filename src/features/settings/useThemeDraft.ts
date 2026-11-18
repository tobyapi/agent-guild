import { useState } from 'react';
import { parseCandidate, type ThemeCandidate, type SavedTheme, uuidPattern } from '@/shared/theme/candidate';
import { checkTheme, type ContrastIssue } from '@/shared/theme/checkTheme';
import { useDraftRequest } from './useDraftRequest';
import { settingsApi } from './api';
import { themeActions } from './appearance';

type Stage = 'subject' | 'palette' | 'image' | 'chooseImage' | 'preview';

export function useThemeDraft(textBackend: string, imageBackend: string, onClose: () => void) {
  const [subject, setSubject] = useState('');
  const [stage, setStage] = useState<Stage>('subject');
  const [candidate, setCandidate] = useState<ThemeCandidate | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [issues, setIssues] = useState<ContrastIssue[]>([]);
  const [problem, setProblem] = useState<'' | 'failed' | 'invalid' | 'save' | 'cancel'>('');
  const requestState = useDraftRequest(onClose, () => {
    setProblem('cancel');
    setStage(candidate ? 'chooseImage' : 'subject');
  });
  const { start, current, finish, close, stopping, busy } = requestState;
  const background = imageGenerator(imageBackend, requestState, setStage, setImage, setProblem);
  async function generate() {
    if (busy() || !textBackend || !subject.trim() || Array.from(subject.trim()).length > 200) return;
    const request = start('palette');
    setProblem('');
    setIssues([]);
    setCandidate(null);
    setImage(null);
    setStage('palette');
    try {
      const text = await settingsApi.generateTheme(request.id, textBackend, subject.trim());
      if (!current(request)) return;
      const result = inspect(text);
      if (!result.ok) {
        setIssues(result.issues);
        setProblem(result.problem);
        setStage('subject');
        return;
      }
      const draft = result.draft;
      setCandidate(draft);
      finish(request);
      await background(draft);
    } catch {
      if (current(request)) {
        setProblem('failed');
        setStage('subject');
      }
    } finally {
      finish(request);
    }
  }
  function chooseImage(id: string | null) {
    if (id !== null && !uuidPattern.test(id)) return;
    setImage(id);
    setProblem('');
    setStage('preview');
  }
  function save(activate: boolean) {
    if (!candidate || stage !== 'preview') return;
    const theme = themeFromDraft(candidate, image);
    if (themeActions.save(theme, activate)) onClose();
    else setProblem('save');
  }
  return {
    subject,
    setSubject,
    stage,
    candidate,
    image,
    issues,
    problem,
    stopping,
    generate,
    background,
    chooseImage,
    save,
    close,
  };
}

function inspect(text: string) {
  try {
    const draft = parseCandidate(text);
    const issues = checkTheme(draft);
    return issues.length ? { ok: false as const, issues, problem: '' as const } : { ok: true as const, draft };
  } catch {
    return { ok: false as const, issues: [], problem: 'invalid' as const };
  }
}
function imageGenerator(
  imageBackend: string,
  requestState: ReturnType<typeof useDraftRequest>,
  setStage: (stage: Stage) => void,
  setImage: (id: string) => void,
  setProblem: (problem: '' | 'failed') => void,
) {
  return background;
  async function background(draft: ThemeCandidate) {
    if (requestState.busy()) return;
    setProblem('');
    if (!imageBackend) {
      setStage('chooseImage');
      return;
    }
    const request = requestState.start('image');
    setStage('image');
    try {
      const id = await settingsApi.generateBackground(request.id, imageBackend, draft.background.description);
      if (!uuidPattern.test(id)) throw new Error('image id');
      if (requestState.current(request)) {
        setImage(id);
        setStage('preview');
      }
    } catch {
      if (requestState.current(request)) {
        setStage('chooseImage');
        setProblem('failed');
      }
    } finally {
      requestState.finish(request);
    }
  }
}

function themeFromDraft(candidate: ThemeCandidate, image: string | null): SavedTheme {
  const { schemaVersion, name, variants, corners, typeStyle } = candidate;
  return {
    schemaVersion,
    name: name.trim(),
    variants,
    corners,
    typeStyle,
    backgroundId: image,
    id: 'user-' + crypto.randomUUID(),
  };
}
