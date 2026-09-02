import './styles/document.css';
import './styles/editor.css';
import { Editor, type QuireApi } from './editor';
import { migrate } from './model';
import seedJSON from './seed.json';

declare global {
  interface Window { Quire: QuireApi }
}

const seed = migrate(seedJSON);
const editor = new Editor(seed);
window.Quire = editor.api;

const open = new URLSearchParams(location.search).get('open');
if (open) void editor.openFromURL(open);
else editor.render();
