import { describe, expect, test } from 'vitest';
import { applicable, matchCommands, type Command, type CommandContext } from '../../src/commands';

const noop = (): void => undefined;
const cmds: Command[] = [
  { id: 'bold', label: 'Bold', group: 'Format', when: (c) => c.hasSelection, run: noop },
  { id: 'flag', label: 'Flag for confirmation', group: 'Format', when: (c) => c.inText, run: noop },
  { id: 'add-skills', label: 'Skills list', group: 'Insert', run: noop },
  { id: 'add-prose', label: 'Text section', group: 'Insert', run: noop },
  { id: 'print', label: 'Print', group: 'File', run: noop },
  { id: 'goto-2', label: 'Career history', group: 'Go to', run: noop },
];
const ctx: CommandContext = { hasDocument: true, inText: true, hasSelection: false, inFlag: false, inItem: true, inBlock: true };

describe('commands', () => {
  test('applicable drops commands whose condition fails', () => {
    expect(applicable(cmds, ctx).map((c) => c.id)).not.toContain('bold');
    expect(applicable(cmds, { ...ctx, hasSelection: true }).map((c) => c.id)).toContain('bold');
  });

  test('an empty query lists everything in group order', () => {
    expect(matchCommands(cmds, '').map((c) => c.group)).toEqual(['Format', 'Format', 'Insert', 'Insert', 'Go to', 'File']);
  });

  test('word-initial matches rank above substring matches', () => {
    expect(matchCommands(cmds, 'ski').map((c) => c.id)).toEqual(['add-skills']);
    expect(matchCommands(cmds, 'list').map((c) => c.id)).toEqual(['add-skills']);
    expect(matchCommands(cmds, 'go').map((c) => c.id)).toEqual(['goto-2']);
    expect(matchCommands(cmds, 'zzz')).toEqual([]);
  });
});
