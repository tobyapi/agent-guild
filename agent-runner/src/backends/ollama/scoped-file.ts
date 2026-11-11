// Runs as fixed application code inside Seatbelt; model input is JSON, never JavaScript.
// Pin the opened inode before reading/truncating so a path replacement cannot swap in a hardlink.
export const SCOPED_FILE_SCRIPT = String.raw`
import { constants } from 'node:fs';
import { open, realpath, lstat, readdir } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { path, roots, mode, content, limit } = JSON.parse(Buffer.concat(chunks).toString());
const inside = (target, root) => {
  const part = relative(root, target);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('../'));
};
const approved = async () => {
  const actual = await realpath(path);
  if (actual !== path || !roots.some(root => inside(actual, root))) throw Error('作業範囲またはパスの実体が変わりました');
  return lstat(path);
};
let handle;
try {
  if (mode === 'list_files') {
    const info = await approved();
    if (!info.isDirectory()) throw Error('フォルダを指定してください');
    const entries = await readdir(path);
    const checked = await approved();
    if (info.ino !== checked.ino || info.dev !== checked.dev) throw Error('フォルダの実体が変わりました');
    const result = entries.join('\n');
    if (Buffer.byteLength(result) > limit) throw Error('道具の出力が32KiBを超えました');
    process.stdout.write(result);
  } else {
    const nofollow = constants.O_NOFOLLOW | constants.O_NONBLOCK;
    if (mode === 'write_file') {
      try { handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | nofollow, 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        handle = await open(path, constants.O_WRONLY | nofollow);
      }
    } else handle = await open(path, constants.O_RDONLY | nofollow);
    const info = await handle.stat();
    const checked = await approved();
    if (!info.isFile() || info.nlink !== 1 || checked.nlink !== 1 || info.ino !== checked.ino || info.dev !== checked.dev)
      throw Error('特殊ファイル・ハードリンク・差し替えられたファイルは扱えません');
    if (mode === 'write_file') {
      await handle.truncate(0);
      await handle.writeFile(content, 'utf8');
      process.stdout.write('written');
    } else {
      const buffer = Buffer.alloc(limit + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > limit) throw Error('道具の出力が32KiBを超えました');
      process.stdout.write(buffer.subarray(0, bytesRead));
    }
  }
} catch (error) {
  process.stderr.write(error.message);
  process.exitCode = 1;
} finally { await handle?.close(); }
`;
