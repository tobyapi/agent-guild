// スキルを Claude のローカルプラグインとして stateDir に書き出す（エージェントが書ける作業場所の .claude/ は使わない）。

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillPayload } from '../../protocol.ts';
import { writeSkills } from '../skill-files.ts';

const PLUGIN_NAME = 'guild-skills';

/** <stateDir>/guild-skills/ を毎回作り直し、そのパスを返す（.claude-plugin/plugin.json と skills/<name>/SKILL.md） */
export async function writeSkillPlugin(stateDir: string, skills: readonly SkillPayload[]): Promise<string> {
  const dir = join(stateDir, PLUGIN_NAME);
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, '.claude-plugin'), { recursive: true });
  const manifest = { name: PLUGIN_NAME, version: '1.0.0', description: 'AIギルドでこのエージェントに登録されたスキル' };
  await writeFile(join(dir, '.claude-plugin', 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeSkills(join(dir, 'skills'), skills);
  return dir;
}
