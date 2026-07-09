import sanitizeHtml from 'sanitize-html'

// Couleurs hex (#abc, #aabbcc, #aabbccdd) ou rgb()/rgba() avec des composantes
// numériques uniquement. Bloque url(...), expression(...), etc.
const ALLOWED_COLOR =
  /^#[0-9a-fA-F]{3,8}$|^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/

// Tailles en pixels uniquement (ex: 12px, 18px).
const ALLOWED_FONT_SIZE = /^\d+(\.\d+)?px$/

// Alignements de texte valides pour l'extension TextAlign de tiptap.
const ALLOWED_TEXT_ALIGN = /^(left|right|center|justify)$/

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Calqué sur ce que RichTextEditor (StarterKit réduit + TextStyle + Color +
  // FontSize + TextAlign sur paragraph) peut réellement produire.
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'span'],
  allowedAttributes: {
    p: ['style'],
    span: ['style'],
  },
  allowedStyles: {
    '*': {
      color: [ALLOWED_COLOR],
      'font-size': [ALLOWED_FONT_SIZE],
      'text-align': [ALLOWED_TEXT_ALIGN],
    },
  },
  allowedSchemes: [],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
}

/**
 * Assainit un commentaire riche (HTML) produit par RichTextEditor avant
 * écriture en base. Whitelist stricte : voir SANITIZE_OPTIONS ci-dessus.
 *
 * Retourne `null` si l'entrée est vide/absente, ou si le texte visible après
 * assainissement est vide (ex: "<p></p>", ou un tag dangereux sans texte
 * comme "<img ...>").
 */
export function sanitizeRichText(html: string | null | undefined): string | null {
  if (!html) return null

  const clean = sanitizeHtml(html, SANITIZE_OPTIONS)

  const visibleText = clean
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()

  if (!visibleText) return null

  return clean
}
