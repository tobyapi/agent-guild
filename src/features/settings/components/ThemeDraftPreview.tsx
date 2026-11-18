import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ThemeCandidate } from '@/shared/theme/candidate';
import { resolveAppearance } from '@/shared/theme/resolve';
import type { Scheme } from '@/shared/theme/types';
import tokens from '@/shared/ui/theme/tokens.css?inline';
import global from '@/shared/ui/theme/global.css?inline';
import css from './themeSample.css?inline';
import { Segment } from '@/shared/ui';
import { useAppearanceStore } from '../appearance';
import { applyAppearance } from '../appearanceStore';
import { paintTheme } from '../themeDocument';
import { useBackgroundImage } from '../useBackgroundImage';
import { tAppearance as t } from '../i18n/appearance';

export function ThemeDraftPreview({ candidate, image }: { candidate: ThemeCandidate; image: string | null }) {
  const [scheme, setScheme] = useState<Scheme>('dark');
  const [choice, setChoice] = useState<'current' | 'candidate'>('candidate');
  const [doc, setDoc] = useState<Document | null>(null);
  // The initial empty document inherits the app CSP and never navigates.
  const attach = useCallback((frame: HTMLIFrameElement | null) => setDoc(frame?.contentDocument ?? null), []);
  const state = useAppearanceStore((s) => s);
  const current = useMemo(
    () => resolveAppearance({ ...state.active, schemePreference: scheme }, state.registry, scheme),
    [state.active, state.registry, scheme],
  );
  const showing = choice === 'candidate';
  const background = useMemo(
    () =>
      showing
        ? image
          ? { kind: 'image' as const, assetId: image }
          : { kind: 'none' as const }
        : current.backgroundOverride,
    [showing, image, current.backgroundOverride],
  );
  const url = useBackgroundImage(background.kind === 'image' ? background.assetId : null);
  useEffect(() => {
    if (!doc) return;
    const bg = url ? background : { kind: 'none' as const };
    const appearance = {
      ...current,
      themeId: showing ? 'candidate' : current.themeId,
      scheme,
      accentOverride: showing ? null : current.accentOverride,
      backgroundOverride: bg,
      glass: bg.kind === 'none' ? ('none' as const) : ('frosted' as const),
    };
    applyAppearance(doc.documentElement, appearance);
    paintTheme(
      doc.documentElement,
      appearance,
      showing ? candidate : state.themes.find((theme) => theme.id === current.themeId),
    );
  }, [doc, background, url, current, showing, scheme, candidate, state.themes]);
  return (
    <>
      <Segment
        label={t('previewCompare')}
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'current', label: t('previewCurrent') },
          { value: 'candidate', label: t('previewCandidate') },
        ]}
      />
      <Segment
        label={t('schemeLabel')}
        value={scheme}
        onChange={setScheme}
        options={[
          { value: 'dark', label: t('themeGuildDark') },
          { value: 'light', label: t('themeGuildLight') },
        ]}
      />
      <iframe
        title={t('previewCompare')}
        sandbox="allow-same-origin"
        ref={attach}
        onLoad={(e) => setDoc(e.currentTarget.contentDocument)}
        style={{ width: '100%', height: '16rem' }}
      />
      {doc && createPortal(<Sample name={showing ? candidate.name : t('previewCurrent')} url={url} />, doc.body)}
    </>
  );
}

function Sample({ name, url }: { name: string; url: string | null }) {
  return (
    <>
      <style>{tokens + global + css}</style>
      <main style={url ? ({ '--preview-image': 'url("' + url + '")' } as CSSProperties) : undefined}>
        <aside># {t('sampleChannel')}</aside>
        <section>
          <h2>{name}</h2>
          <p>
            {t('sampleMessage')} <time>09:18</time>
          </p>
          <code>theme.json</code>
          <label>
            {t('sampleSettings')} <input placeholder={t('sampleInput')} readOnly />
          </label>
          <button>{t('themeSave')}</button>
        </section>
      </main>
    </>
  );
}
