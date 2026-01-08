export const locales = ['fr', 'ar', 'en'] as const
export const defaultLocale = 'fr' as const

export type Locale = (typeof locales)[number]
