import * as defaultFs from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

async function exists(path, fs) {
  try { await fs.lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function publishDirectory(outDir, writeCandidate, options = {}) {
  const fs = options.fs ?? defaultFs;
  const output = resolve(outDir);
  const parent = dirname(output);
  await fs.mkdir(parent, { recursive: true });
  const candidate = await fs.mkdtemp(`${parent}/${basename(output)}.candidate-`);
  const backup = await fs.mkdtemp(`${parent}/${basename(output)}.backup-`);
  await fs.rm(backup, { recursive: true, force: true });
  let movedOld = false;
  try {
    await writeCandidate(candidate);
    if (await exists(output, fs)) { await fs.rename(output, backup); movedOld = true; }
    try { await fs.rename(candidate, output); } catch (error) {
      if (movedOld) await fs.rename(backup, output);
      throw error;
    }
    if (movedOld) await fs.rm(backup, { recursive: true, force: true });
    return output;
  } finally {
    await fs.rm(candidate, { recursive: true, force: true }).catch(() => {});
    if (await exists(backup, fs).catch(() => false)) {
      if (movedOld && !(await exists(output, fs).catch(() => false))) await fs.rename(backup, output).catch(() => {});
      else await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
    }
  }
}
