'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const languages = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

export function LanguageSelector() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (newLocale: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(fr|ar|en)/, '')
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  const currentLang = languages.find((l) => l.code === locale)

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-[130px]">
        <SelectValue>
          {currentLang && (
            <span className="flex items-center gap-2">
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
