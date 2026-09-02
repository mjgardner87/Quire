/** Phosphor icons (MIT), inlined at build time. One stroke weight throughout the chrome. */
import arrowUp from '@phosphor-icons/core/assets/regular/arrow-up.svg?raw';
import arrowDown from '@phosphor-icons/core/assets/regular/arrow-down.svg?raw';
import arrowLineDown from '@phosphor-icons/core/assets/regular/arrow-line-down.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';
import plus from '@phosphor-icons/core/assets/regular/plus.svg?raw';
import undo from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw';
import redo from '@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw';
import printer from '@phosphor-icons/core/assets/regular/printer.svg?raw';
import save from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import open from '@phosphor-icons/core/assets/regular/upload-simple.svg?raw';
import versions from '@phosphor-icons/core/assets/regular/clock-counter-clockwise.svg?raw';
import swatches from '@phosphor-icons/core/assets/regular/swatches.svg?raw';
import rows from '@phosphor-icons/core/assets/regular/rows.svg?raw';
import flag from '@phosphor-icons/core/assets/regular/flag.svg?raw';
import dots from '@phosphor-icons/core/assets/regular/dots-three.svg?raw';
import grip from '@phosphor-icons/core/assets/regular/dots-six-vertical.svg?raw';
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import trash from '@phosphor-icons/core/assets/regular/trash.svg?raw';
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import caretRight from '@phosphor-icons/core/assets/regular/caret-right.svg?raw';
import article from '@phosphor-icons/core/assets/regular/article.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import idCard from '@phosphor-icons/core/assets/regular/identification-card.svg?raw';
import textLines from '@phosphor-icons/core/assets/regular/text-align-left.svg?raw';
import bullets from '@phosphor-icons/core/assets/regular/list-bullets.svg?raw';
import briefcase from '@phosphor-icons/core/assets/regular/briefcase.svg?raw';
import columns from '@phosphor-icons/core/assets/regular/columns.svg?raw';
import tag from '@phosphor-icons/core/assets/regular/tag.svg?raw';
import checkSquare from '@phosphor-icons/core/assets/regular/check-square.svg?raw';
import envelope from '@phosphor-icons/core/assets/regular/envelope-simple.svg?raw';
import penNib from '@phosphor-icons/core/assets/regular/pen-nib.svg?raw';
import paragraph from '@phosphor-icons/core/assets/regular/paragraph.svg?raw';
import medal from '@phosphor-icons/core/assets/regular/medal.svg?raw';
import user from '@phosphor-icons/core/assets/regular/user.svg?raw';

const RAW = {
  arrowUp, arrowDown, arrowLineDown, x, plus, undo, redo, printer, save, open, versions, swatches, rows, flag, dots, grip,
  copy, trash, caretLeft, caretRight, article, check, idCard, textLines, bullets, briefcase, columns, tag, checkSquare,
  envelope, penNib, paragraph, medal, user,
} as const;
export type IconName = keyof typeof RAW;

/** An inline SVG element for the named icon. Decorative: the owning control carries the label. */
export function icon(name: IconName): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = RAW[name].replace('<svg ', '<svg class="icon" aria-hidden="true" focusable="false" ');
  return tpl.content.firstElementChild as SVGElement;
}

/** The icon that stands for a block in the structure rail and the section picker. */
export function blockIconName(type: string, kind?: string): IconName {
  switch (type) {
    case 'masthead': return 'idCard';
    case 'docmast': return 'article';
    case 'opening': return 'paragraph';
    case 'criterion': return 'checkSquare';
    case 'closing': return 'user';
    case 'letterhead': return 'envelope';
    case 'signoff': return 'penNib';
    case 'section':
      switch (kind) {
        case 'achievements': return 'medal';
        case 'entries': return 'briefcase';
        case 'columns': return 'columns';
        case 'skills': return 'tag';
        default: return 'textLines';
      }
    default: return 'article';
  }
}
