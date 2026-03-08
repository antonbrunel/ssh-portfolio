// ANSI escape codes and terminal rendering utilities

export const A = {
  reset:      '\x1b[0m',
  bold:       '\x1b[1m',
  dim:        '\x1b[2m',
  reverse:    '\x1b[7m',
  white:      '\x1b[97m',
  lightBlue:  '\x1b[94m',
  cursorHide:     '\x1b[?25l',
  cursorShow:     '\x1b[?25h',
  clear:          '\x1b[2J\x1b[H',
  altScreenEnter: '\x1b[?1049h',
  altScreenExit:  '\x1b[?1049l',
};

/** Strip ANSI escape sequences to measure visible width */
export function visibleLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*[mGKHJ]/g, '').length;
}

/** Center a string within a given visible width */
export function center(s: string, width: number): string {
  const len = visibleLen(s);
  const total = Math.max(0, width - len);
  const left = Math.floor(total / 2);
  const right = total - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

/**
 * Builds a complete screen frame as an array of rows.
 * Call render() to get the final ANSI string to write to the stream.
 */
export class Frame {
  private lines: string[] = [];
  readonly cols: number;
  readonly rows: number;

  constructor(cols: number, rows: number) {
    this.cols = Math.max(cols, 4);
    this.rows = Math.max(rows, 4);
  }

  /** Number of lines pushed so far */
  get lineCount(): number {
    return this.lines.length;
  }

  push(line: string): this {
    this.lines.push(line);
    return this;
  }

  /** Horizontal rule using box-drawing chars */
  hr(left = '├', fill = '─', right = '┤'): this {
    const inner = Math.max(0, this.cols - 2);
    this.lines.push(left + fill.repeat(inner) + right);
    return this;
  }

  top(): this    { return this.hr('┌', '─', '┐'); }
  bottom(): this { return this.hr('└', '─', '┘'); }

  /** A row with side borders, content padded to fill width */
  row(content: string): this {
    const inner = Math.max(0, this.cols - 2);
    const vLen = visibleLen(content);
    const fill = Math.max(0, inner - vLen);
    this.lines.push('│' + content + ' '.repeat(fill) + '│');
    return this;
  }

  /** Empty row with side borders */
  blank(): this {
    return this.row('');
  }

  /** Centered content row */
  centered(content: string): this {
    const inner = Math.max(0, this.cols - 2);
    return this.row(center(content, inner));
  }

  /** Horizontal rule that opens a two-column split */
  splitHrOpen(splitAt: number): this {
    const safe = Math.min(Math.max(splitAt, 1), this.cols - 3);
    const left  = '├' + '─'.repeat(safe - 1) + '┬';
    const right = '─'.repeat(Math.max(0, this.cols - safe - 2)) + '┤';
    this.lines.push(left + right);
    return this;
  }

  /** Horizontal rule that closes a two-column split */
  splitHr(splitAt: number): this {
    const safe = Math.min(Math.max(splitAt, 1), this.cols - 3);
    const left  = '├' + '─'.repeat(safe - 1) + '┴';
    const right = '─'.repeat(Math.max(0, this.cols - safe - 2)) + '┤';
    this.lines.push(left + right);
    return this;
  }

  render(): string {
    const output: string[] = [];
    for (let i = 0; i < this.rows; i++) {
      const line = this.lines[i] ?? '';
      const vLen = visibleLen(line);
      const padded = vLen < this.cols ? line + ' '.repeat(this.cols - vLen) : line;
      output.push(padded);
    }
    return A.clear + output.join('\r\n');
  }
}
