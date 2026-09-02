/**
 * Commands: one list drives the right-click menu, the selection toolbar and the Ctrl+K palette.
 * The list itself is built in the editor (it needs the editor's methods); the matching here is
 * pure so it can be unit tested.
 */

export interface CommandContext {
  hasDocument: boolean;
  inText: boolean;        /* the caret is in an editable run */
  hasSelection: boolean;  /* and the selection is not collapsed */
  inFlag: boolean;        /* the caret is inside a flag */
  inItem: boolean;        /* the run is a list member: bullet, paragraph, skill, line */
  inBlock: boolean;       /* the run sits in a movable block */
}

export type CommandGroup = 'Format' | 'Insert' | 'Structure' | 'Go to' | 'Document' | 'File';

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  keys?: string;
  /** Present in the palette and menus only when this returns true. */
  when?: (ctx: CommandContext) => boolean;
  /** Show in the right-click menu. Palette shows every applicable command. */
  contextual?: boolean;
  run: () => void;
}

export const GROUP_ORDER: readonly CommandGroup[] = ['Format', 'Structure', 'Insert', 'Go to', 'Document', 'File'];

export function applicable(commands: readonly Command[], ctx: CommandContext): Command[] {
  return commands.filter((c) => !c.when || c.when(ctx));
}

/**
 * Filter and rank commands for a palette query. Word-initial matches rank first, then any
 * substring match, in group order. An empty query returns everything in group order.
 */
export function matchCommands(commands: readonly Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  const byGroup = (a: Command, b: Command): number => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (!q) return [...commands].sort(byGroup);
  const score = (c: Command): number => {
    const label = c.label.toLowerCase();
    const words = label.split(/\s+/);
    if (label.startsWith(q)) return 3;
    if (words.some((w) => w.startsWith(q))) return 2;
    if (label.includes(q) || c.group.toLowerCase().includes(q)) return 1;
    return 0;
  };
  return commands
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || byGroup(a.c, b.c))
    .map((x) => x.c);
}
