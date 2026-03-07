import type { ServerChannel } from 'ssh2';
import { A, Frame, visibleLen } from './renderer';
import { CONTENT, ASCII_PORTRAIT, type Lang } from './content';

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
  private lang: Lang = 'en';

  constructor(stream: ServerChannel, dims: { cols: number; rows: number }) {
    this.stream = stream;
    this.cols = Math.max(dims.cols, 60);
    this.rows = Math.max(dims.rows, 20);
    this.init();
  }

  private init(): void {
    this.stream.write(A.altScreenEnter + A.cursorHide);
    this.render();
    this.stream.on('data', (data: Buffer) => this.handleInput(data));
    this.stream.on('close', () => this.cleanup());
    this.stream.on('error', () => this.cleanup());
  }

  resize(cols: number, rows: number): void {
    if (this.closed) return;
    this.cols = Math.max(cols, 60);
    this.rows = Math.max(rows, 20);
    this.render();
  }

  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.quitTimer) {
      clearTimeout(this.quitTimer);
      this.quitTimer = null;
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
    const f = new Frame(this.cols, this.rows);
    const splitAt = Math.min(28, Math.floor(this.cols * 0.36));

    f.top();
    f.blank();
    f.centered(A.bold + A.white + CONTENT.name + A.reset);
    f.centered(A.dim + c.tagline + A.reset);
    f.blank();
    f.splitHrOpen(splitAt);

    const rightWidth = this.cols - splitAt - 3;
    const pitchLines: string[] = [
      '',
      ...c.pitch.map((l, i) =>
        l === ''
          ? ''
          : i === 0
            ? A.bold + A.white + l + A.reset
            : A.dim + l + A.reset
      ),
      '',
    ];

    const portrait = ASCII_PORTRAIT;
    const totalRows = Math.max(portrait.length, pitchLines.length);
    const leftInner = splitAt - 1;

    for (let i = 0; i < totalRows; i++) {
      const leftRaw = portrait[i] ?? '';
      const rightRaw = pitchLines[i] ?? '';
      const lv = visibleLen(leftRaw);
      const rv = visibleLen(rightRaw);
      const leftPad = leftRaw + ' '.repeat(Math.max(0, leftInner - lv));
      const rightPad = rightRaw + ' '.repeat(Math.max(0, rightWidth - rv));
      f.push('│' + leftPad + '│' + ' ' + rightPad + '│');
    }

    f.splitHr(splitAt);
    f.blank();

    const tabBar = c.tabs.map((tab, i) =>
      i === this.selectedTab
        ? A.reverse + A.bold + '  ' + tab + '  ' + A.reset
        : A.dim + '  ' + tab + '  ' + A.reset
    ).join('   ');
    f.centered(tabBar);
    f.blank();

    f.hr();
    f.row(A.dim + c.hints.home + A.reset);
    f.bottom();

    return f.render();
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
