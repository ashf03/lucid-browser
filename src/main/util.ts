/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';

/** Resolves the renderer HTML URL for dev (Vite) vs production (file://). */
export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}
