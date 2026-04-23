/**
 * Convert TipTap/rich-text HTML to WhatsApp-safe plain text.
 * WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```code```
 * Everything else must be plain text.
 */
export function htmlToWhatsApp(html: string): string {
  if (!html || !html.trim()) return '';

  return html
    // Headings → bold line
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n*$1*\n')
    // Bold
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '*$2*')
    // Italic
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '_$2_')
    // Strikethrough
    .replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/(s|strike|del)>/gi, '~$2~')
    // Code block / inline code
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```$1```\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // Ordered list items — number them
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
      let counter = 0;
      return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, content: string) => {
        counter++;
        return `\n${counter}. ${content.trim()}`;
      });
    })
    // Unordered list items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1')
    // Blockquote
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n_$1_\n')
    // Horizontal rule
    .replace(/<hr[^>]*\/?>/gi, '\n──────────\n')
    // Block-level element closers → newline
    .replace(/<\/(p|div|section|article|blockquote|ul|ol|li|h[1-6])>/gi, '\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Anchor tags — keep visible text + URL if different
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      const cleanText = stripTags(text).trim();
      return cleanText && cleanText !== href ? `${cleanText} (${href})` : href;
    })
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Truncate text to WhatsApp's practical limit per message (~1600 chars).
 * Splits gracefully at a sentence boundary.
 */
export function truncateForWhatsApp(text: string, maxChars = 1600): string {
  if (text.length <= maxChars) return text;
  const cutoff = text.lastIndexOf('.', maxChars - 80);
  const at = cutoff > maxChars / 2 ? cutoff + 1 : maxChars - 80;
  return text.slice(0, at).trim() + '\n\n_…continued on ZimHealth web app_';
}
