import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert line breaks to <br>
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Highlight.js error:', err);
      }
    }
    // Fallback to auto-highlighting
    try {
      return hljs.highlightAuto(code).value;
    } catch (err) {
      console.error('Auto-highlight error:', err);
      return code;
    }
  }
});

export function renderMessage(text) {
  // Parse markdown to HTML
  const html = marked.parse(text);
  
  // Sanitize HTML to prevent XSS
  const cleanHtml = DOMPurify.sanitize(html);
  
  return cleanHtml;
}
