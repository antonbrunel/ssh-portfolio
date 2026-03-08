import type { ServerChannel } from 'ssh2';
import { A, Frame, visibleLen } from './renderer';
import { CONTENT, ASCII_PORTRAIT, type Lang } from './content';
import { ANTON_ART, BRUNEL_ART } from './ascii';

const STAR_CHARS = ['·', '✦', '⋆', '✧', '˚', '⊹'] as const;
// Blank rows in the right panel where stars can appear (0-indexed, relative to screen)
const HOME_STAR_ROWS = [0, 6, 12] as const;

type Screen = 'home' | 'projects' | 'about' | 'contact';

export class PortfolioApp {
  private stream: ServerChannel;
  private cols: number;
  private rows: number;
  private screen: Screen = 'home';
  private selectedTab = 0;
  private projectIndex = 0;
  private closed = false;
  private quitTimer: ReturnType<typeof setTimeout> | null = null;
  private starTimer: ReturnType<typeof setInterval> | null = null;
  private stars: Array<{ row: number; col: number; char: string; on: boolean }> = [];
  private cachedArtWidth = 35; // updated after each buildHome call
  private lang: Lang = 'en';

  constructor(stream: ServerChannel, dims: { cols: number; rows: number }) {
    this.stream = stream;
    this.cols = Math.max(dims.cols, 60);
    this.rows = Math.max(dims.rows, 20);
    this.init();
  }

  private init(): void {
    this.stream.write(A.altScreenEnter + A.cursorHide);
    this.initStars();
    this.render();
    this.stream.on('data', (data: Buffer) => this.handleInput(data));
    this.stream.on('close', () => this.cleanup());
    this.stream.on('error', () => this.cleanup());
  }

  resize(cols: number, rows: number): void {
    if (this.closed) return;
    this.cols = Math.max(cols, 60);
    this.rows = Math.max(rows, 20);
    this.initStars();
    this.render();
  }

  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.quitTimer) {
      clearTimeout(this.quitTimer);
      this.quitTimer = null;
    }
    if (this.starTimer) {
      clearInterval(this.starTimer);
      this.starTimer = null;
    }
    try {
      this.stream.write(A.altScreenExit + A.cursorShow + A.reset);
    } catch { /* stream may already be closed */ }
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  private handleInput(data: Buffer): void {
    if (this.closed) return;
    const key = data.toString('utf8');

    // Universal: Ctrl+C, Ctrl+D → quit
    if (key === '\x03' || key === '\x04') { this.quit(); return; }

    // Universal: L → toggle language
    if (key === 'l' || key === 'L') { this.toggleLang(); return; }

    if (this.screen === 'home') {
      this.handleHomeInput(key);
    } else if (this.screen === 'projects') {
      this.handleProjectsInput(key);
    } else {
      this.handleBackInput(key);
    }
  }

  private toggleLang(): void {
    this.lang = this.lang === 'en' ? 'fr' : 'en';
    this.render();
  }

  private handleHomeInput(key: string): void {
    switch (key) {
      case '\x1b[C': // Right arrow
        this.selectedTab = (this.selectedTab + 1) % 3;
        this.render();
        break;
      case '\x1b[D': // Left arrow
        this.selectedTab = (this.selectedTab + 2) % 3;
        this.render();
        break;
      case '\r':
      case '\n':
        this.screen = (['projects', 'about', 'contact'] as Screen[])[this.selectedTab];
        this.projectIndex = 0;
        this.render();
        break;
      case 'q':
      case 'Q':
        this.quit();
        break;
    }
  }

  private handleProjectsInput(key: string): void {
    const projects = CONTENT[this.lang].projects;
    switch (key) {
      case '\x1b[A': // Up arrow
        this.projectIndex = Math.max(0, this.projectIndex - 1);
        this.render();
        break;
      case '\x1b[B': // Down arrow
        this.projectIndex = Math.min(projects.length - 1, this.projectIndex + 1);
        this.render();
        break;
      case '\x1b':
      case '\x7f':
      case 'q':
      case 'Q':
        this.goHome();
        break;
    }
  }

  private handleBackInput(key: string): void {
    if (key === '\x1b' || key === '\x7f' || key === 'q' || key === 'Q' || key === '\r') {
      this.goHome();
    }
  }

  private goHome(): void {
    this.screen = 'home';
    this.render();
  }

  private quit(): void {
    if (this.closed) return;
    this.closed = true;

    const c = CONTENT[this.lang];
    const f = new Frame(this.cols, this.rows);
    f.top();
    for (let i = 0; i < this.rows - 4; i++) f.blank();
    f.centered(A.dim + c.goodbye + A.reset);
    f.blank();
    f.bottom();

    try {
      this.stream.write(f.render() + '\r\n');
    } catch { /* ignore */ }

    this.quitTimer = setTimeout(() => {
      try {
        this.stream.write(A.altScreenExit + A.cursorShow);
        this.stream.end();
      } catch { /* ignore */ }
    }, 500);
  }

  // ─── Render dispatcher ──────────────────────────────────────────────────────

  private render(): void {
    if (this.closed) return;
    let output: string;
    switch (this.screen) {
      case 'home':     output = this.buildHome();     break;
      case 'projects': output = this.buildProjects(); break;
      case 'about':    output = this.buildAbout();    break;
      case 'contact':  output = this.buildContact();  break;
    }
    try {
      this.stream.write(output);
    } catch { this.cleanup(); }
  }

  // ─── Home screen ────────────────────────────────────────────────────────────

  private buildHome(): string {
    const c = CONTENT[this.lang];

    // Portrait scales to fill the full terminal height
    const art = this.scaleArt(ASCII_PORTRAIT, this.rows);
    const artWidth = art.length > 0 ? Math.max(...art.map(l => visibleLen(l))) : 0;
    this.cachedArtWidth = artWidth;
    const gap = 3;

    // Right panel layout (row indices relative to screen):
    //   0        → blank  (stars)
    //   1–5      → ANTON_ART
    //   6        → blank  (stars)
    //   7–11     → BRUNEL_ART
    //   12       → blank  (stars)
    //   13+      → pitch
    //   rows-4   → tabs
    //   rows-2   → hints
    const right: string[] = new Array(this.rows).fill('');

    // ANTON (rows 1-5)
    for (let i = 0; i < ANTON_ART.length; i++) {
      if (1 + i >= this.rows) break;
      right[1 + i] = A.bold + A.white + ANTON_ART[i] + A.reset;
    }

    // BRUNEL (rows 7-11)
    for (let i = 0; i < BRUNEL_ART.length; i++) {
      if (7 + i >= this.rows) break;
      right[7 + i] = A.bold + A.white + BRUNEL_ART[i] + A.reset;
    }

    // Pitch (starting at row 13)
    let row = 13;
    let firstLine = true;
    for (const line of c.pitch) {
      if (row >= this.rows - 6) break;
      if (line === '') { row++; continue; }
      right[row] = firstLine
        ? A.bold + A.white + line + A.reset
        : A.dim + line + A.reset;
      firstLine = false;
      row++;
    }

    // Tabs and hints near bottom
    const tabRow = this.rows - 4;
    if (tabRow > 0) {
      right[tabRow] = c.tabs.map((tab, i) =>
        i === this.selectedTab
          ? A.bold + A.white + tab + A.reset
          : A.dim + tab.toLowerCase() + A.reset
      ).join('   ');
    }
    const hintRow = this.rows - 2;
    if (hintRow > 0) {
      right[hintRow] = A.dim + c.hints.home + A.reset;
    }

    // Assemble: portrait (left) + gap + right panel
    const lines: string[] = [];
    for (let i = 0; i < this.rows; i++) {
      const leftRaw = art[i] ?? '';
      const lv = visibleLen(leftRaw);
      const leftPadded = leftRaw + ' '.repeat(Math.max(0, artWidth - lv));
      lines.push(leftPadded + ' '.repeat(gap) + (right[i] ?? ''));
    }

    return A.clear + lines.join('\r\n') + this.renderStars();
  }

  /** Scale art to exactly targetRows lines using nearest-neighbor */
  private scaleArt(art: string[], targetRows: number): string[] {
    if (art.length === 0) return new Array(targetRows).fill('');
    const result: string[] = [];
    for (let i = 0; i < targetRows; i++) {
      const srcIdx = Math.min(
        Math.floor((i / targetRows) * art.length),
        art.length - 1
      );
      result.push(art[srcIdx]);
    }
    return result;
  }

  /** Seed star positions in the right-panel blank rows and start the blink timer */
  private initStars(): void {
    if (this.starTimer) {
      clearInterval(this.starTimer);
      this.starTimer = null;
    }
    this.stars = [];
    const minCol = this.cachedArtWidth + 4; // stay in the right panel
    const maxCol = this.cols - 2;
    if (maxCol > minCol) {
      const count = 24;
      for (let i = 0; i < count; i++) {
        const starRow = HOME_STAR_ROWS[Math.floor(Math.random() * HOME_STAR_ROWS.length)];
        const col = minCol + Math.floor(Math.random() * (maxCol - minCol));
        const char = STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)];
        this.stars.push({ row: starRow, col, char, on: Math.random() > 0.5 });
      }
    }
    this.starTimer = setInterval(() => {
      if (this.closed || this.screen !== 'home') return;
      const minC = this.cachedArtWidth + 4;
      const maxC = this.cols - 2;
      for (const star of this.stars) {
        if (Math.random() < 0.3) {
          star.on = !star.on;
          if (!star.on && Math.random() < 0.15 && maxC > minC) {
            star.col = minC + Math.floor(Math.random() * (maxC - minC));
            star.char = STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)];
          }
        }
      }
      this.render();
    }, 500);
  }

  /** Write visible stars via cursor-positioning escapes (overlaid after main content) */
  private renderStars(): string {
    let out = '';
    for (const star of this.stars) {
      if (!star.on) continue;
      out += `\x1b[${star.row + 1};${star.col + 1}H${A.dim}${star.char}${A.reset}`;
    }
    return out;
  }

  // ─── Projects screen ────────────────────────────────────────────────────────

  private buildProjects(): string {
    const c = CONTENT[this.lang];
    const f = new Frame(this.cols, this.rows);
    const inner = this.cols - 4;

    f.top();
    f.blank();
    f.centered(A.bold + A.white + `— ${c.tabs[0]} —` + A.reset);
    f.blank();
    f.hr();

    for (let i = 0; i < c.projects.length; i++) {
      const p = c.projects[i];
      const isSelected = i === this.projectIndex;

      f.blank();
      if (isSelected) {
        f.row('  ' + A.bold + A.reverse + ' ' + p.name + ' ' + A.reset);
        f.row('  ' + A.dim + p.tags + A.reset);
        f.blank();
        for (const line of p.description) {
          f.row('    ' + A.white + line + A.reset);
        }
      } else {
        f.row('  ' + A.dim + '○ ' + p.name + A.reset);
        f.row('  ' + A.dim + '  ' + p.tags + A.reset);
      }
      f.blank();
      if (i < c.projects.length - 1) {
        f.row('  ' + A.dim + '·'.repeat(Math.max(0, inner)) + A.reset);
      }
    }

    const remaining = this.rows - f.lineCount - 3;
    for (let i = 0; i < Math.max(0, remaining); i++) f.blank();

    f.hr();
    f.row(A.dim + c.hints.projects + A.reset);
    f.bottom();

    return f.render();
  }

  // ─── About screen ───────────────────────────────────────────────────────────

  private buildAbout(): string {
    const c = CONTENT[this.lang];
    const f = new Frame(this.cols, this.rows);

    f.top();
    f.blank();
    f.centered(A.bold + A.white + `— ${c.tabs[1]} —` + A.reset);
    f.blank();
    f.hr();
    f.blank();

    for (const line of c.about) {
      if (line === '') {
        f.blank();
      } else {
        f.row('  ' + A.dim + line + A.reset);
      }
    }

    f.blank();
    f.hr();
    f.blank();
    const projectList = c.projects.map(p => p.name).join('  ·  ');
    f.centered(A.dim + projectList + A.reset);
    f.blank();

    const remaining = this.rows - f.lineCount - 3;
    for (let i = 0; i < Math.max(0, remaining); i++) f.blank();

    f.hr();
    f.row(A.dim + c.hints.section + A.reset);
    f.bottom();

    return f.render();
  }

  // ─── Contact screen ─────────────────────────────────────────────────────────

  private buildContact(): string {
    const c = CONTENT[this.lang];
    const f = new Frame(this.cols, this.rows);

    f.top();
    f.blank();
    f.centered(A.bold + A.white + `— ${c.tabs[2]} —` + A.reset);
    f.blank();
    f.hr();

    const contentHeight = c.contact.length * 3;
    const available = this.rows - f.lineCount - 5;
    const topPad = Math.max(1, Math.floor((available - contentHeight) / 2));
    for (let i = 0; i < topPad; i++) f.blank();

    for (const item of c.contact) {
      f.centered(A.dim + item.label.toUpperCase() + A.reset);
      f.centered(A.bold + A.white + item.value + A.reset);
      f.blank();
    }

    const remaining = this.rows - f.lineCount - 3;
    for (let i = 0; i < Math.max(0, remaining); i++) f.blank();

    f.hr();
    f.row(A.dim + c.hints.section + A.reset);
    f.bottom();

    return f.render();
  }
}

export function startApp(stream: ServerChannel, dims: { cols: number; rows: number }): PortfolioApp {
  return new PortfolioApp(stream, dims);
}
