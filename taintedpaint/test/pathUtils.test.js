import assert from 'assert'
import { test } from 'node:test'
import { sanitizeRelativePath } from '../lib/pathUtils.mjs'

test('valid path remains unchanged', () => {
  assert.strictEqual(sanitizeRelativePath('subdir/file.txt'), 'subdir/file.txt')
})

test('leading parent directories are stripped', () => {
  assert.strictEqual(sanitizeRelativePath('../file.txt'), 'file.txt')
})

test('normalizes internal traversals', () => {
  assert.strictEqual(sanitizeRelativePath('a/../../b/c.txt'), 'b/c.txt')
})

test('rejects paths containing .. after normalization', () => {
  assert.throws(() => sanitizeRelativePath('foo/..mal/evil.txt'), /Invalid path/)
})

test('strips multiple leading parent directories', () => {
  assert.strictEqual(sanitizeRelativePath('../../foo/bar.txt'), 'foo/bar.txt')
})

test('rejects paths with backslash traversals', () => {
  assert.throws(() => sanitizeRelativePath('foo\\..\\evil.txt'), /Invalid path/)
})


