import { useState } from 'react';
import { useAppearanceStore } from '../appearance';
import { AccentPicker } from './AccentPicker';
import { ThemePicker } from './ThemePicker';
import { ThemeLibraryField } from './ThemeLibraryField';
import styles from './AccentPicker.module.css';

export function AppearanceSection() {
  const [backgroundRevision, setBackgroundRevision] = useState(0);
  const readOnly = useAppearanceStore((state) => state.readOnly);
  return (
    <fieldset disabled={readOnly} className={styles.appearance}>
      <ThemeLibraryField onDraftClosed={() => setBackgroundRevision((value) => value + 1)} />
      <ThemePicker backgroundRevision={backgroundRevision} />
      <AccentPicker />
    </fieldset>
  );
}
