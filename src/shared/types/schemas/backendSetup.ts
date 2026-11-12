// BackendInfo のうち、アダプタが申告するバックエンドごとの違い（指定フォルダの守り方・アプリからのセットアップ）のスキーマ。
import type { ApiKeySpec, BackendSetup, FolderScope, InstallGuide, LoginSpec, StartSpec } from '../domain';
import { nullable, objectOf, oneOf, recordOf, string } from '../schema';
import type { Schema } from '../schema';

export const folderScope = oneOf<FolderScope>({ files: true, sandbox: true });

const installGuideSchema = {
  cli: string,
  publisher: string,
  scriptUrl: string,
  shell: string,
  binary: string,
  env: recordOf(string),
  docsUrl: string,
  loginCommand: string,
} satisfies Schema<InstallGuide>;

const startSpecSchema = { macBundleId: string } satisfies Schema<StartSpec>;
const loginSpecSchema = { label: string, waiting: string } satisfies Schema<LoginSpec>;
const apiKeySpecSchema = { envVar: string } satisfies Schema<ApiKeySpec>;

export const backendSetupSchema = {
  install: nullable(objectOf(installGuideSchema)),
  start: nullable(objectOf(startSpecSchema)),
  login: nullable(objectOf(loginSpecSchema)),
  apiKey: nullable(objectOf(apiKeySpecSchema)),
} satisfies Schema<BackendSetup>;
