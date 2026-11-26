import { AVATAR_GALLERY, AVATAR_PRESETS, type AvatarPresetId } from '@/features/agents';
import { Button, reportError } from '@/shared/ui';
import { settingsApi } from '../api';
import { tGalleryLicenses as t } from '../i18n/galleryLicenses';
import {
  ARTIST_TERMS,
  DEEPSEEK_LICENSE,
  DEEPSEEK_ORIGINAL_CHARACTER,
  GALLERY_ORIGINAL_POSTS,
} from '../model/galleryLicenses';
import { SettingsSection } from './SettingsSection';
import styles from './GalleryLicensesSection.module.css';

export function GalleryLicensesSection() {
  return (
    <SettingsSection title={t('title')}>
      <p className={styles.summary}>{t('summary')}</p>
      <div className={styles.links}>
        <ExternalLink url={AVATAR_GALLERY} label={t('gallery')} />
        <ExternalLink url={ARTIST_TERMS} label={t('artistTerms')} />
      </div>
      <ul className={styles.list}>
        {AVATAR_PRESETS.map(({ id, name }) => (
          <li key={id} className={styles.entry}>
            <strong>{name}</strong>
            <span>{id === 'deepseek' ? t('deepseekCredit') : 'ZipZipPipe'}</span>
            <CharacterTerms id={id} />
            <p>
              <span className={styles.changeLabel}>{t('changes')}</span>
              {t('faceCrop')} · {t(id === 'jev' ? 'existingAlpha' : 'fullBodyCutout')}
            </p>
            <div className={styles.links}>
              <ExternalLink url={GALLERY_ORIGINAL_POSTS[id]} label={t('originalPost')} context={name} />
              {id === 'deepseek' && <ExternalLink url={DEEPSEEK_ORIGINAL_CHARACTER} label={t('originalCharacter')} />}
            </div>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

function CharacterTerms({ id }: { id: AvatarPresetId }) {
  if (id === 'deepseek') return <ExternalLink url={DEEPSEEK_LICENSE} label={t('deepseekTerms')} />;
  return <span>{t(id === 'jev' ? 'unconfirmed' : 'terms')}</span>;
}

function ExternalLink({ url, label, context }: { url: string; label: string; context?: string }) {
  return (
    <Button
      variant="link"
      size="sm"
      className={styles.link}
      aria-label={context ? `${context} · ${label}` : undefined}
      onClick={() => void settingsApi.openUrl(url).catch(reportError)}
    >
      {label}
    </Button>
  );
}
