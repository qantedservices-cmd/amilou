'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { FontSize } from '@/lib/tiptap-font-size'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className,
}: RichTextEditorProps) {
  const suppressUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      if (suppressUpdate.current) return
      let html = editor.getHTML()
      // Map empty paragraph to empty string
      if (html === '<p></p>') html = ''
      onChange(html)
    },
  })

  // Sync external value changes into the editor
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    const normalizedCurrent = currentHtml === '<p></p>' ? '' : currentHtml
    const normalizedValue = value || ''
    if (normalizedCurrent !== normalizedValue) {
      suppressUpdate.current = true
      editor.commands.setContent(normalizedValue || '')
      suppressUpdate.current = false
    }
  }, [value, editor])

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  if (!editor) return null

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Toolbar */}
      {!disabled && (
        <div className="flex items-center gap-1 border-b px-2 py-1 flex-wrap">
          {/* Bold */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleBold().run()
            }}
            className={cn(
              'px-2 py-1 text-xs rounded hover:bg-muted transition-colors',
              editor.isActive('bold') && 'bg-muted font-bold'
            )}
            title="Gras"
          >
            <strong>G</strong>
          </button>

          {/* Color */}
          <select
            className="h-7 text-xs border rounded px-1 bg-background"
            value={editor.getAttributes('textStyle').color || ''}
            onChange={(e) => {
              const color = e.target.value
              if (color) {
                editor.chain().focus().setColor(color).run()
              } else {
                editor.chain().focus().unsetColor().run()
              }
            }}
            title="Couleur"
          >
            <option value="">Couleur</option>
            <option value="#ef4444" style={{ color: '#ef4444' }}>Rouge</option>
            <option value="#f97316" style={{ color: '#f97316' }}>Orange</option>
            <option value="#22c55e" style={{ color: '#22c55e' }}>Vert</option>
            <option value="#3b82f6" style={{ color: '#3b82f6' }}>Bleu</option>
            <option value="#8b5cf6" style={{ color: '#8b5cf6' }}>Violet</option>
          </select>

          {/* Font size */}
          <select
            className="h-7 text-xs border rounded px-1 bg-background"
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={(e) => {
              const size = e.target.value
              if (size) {
                editor.chain().focus().setFontSize(size).run()
              } else {
                editor.chain().focus().unsetFontSize().run()
              }
            }}
            title="Taille"
          >
            <option value="">Taille</option>
            <option value="12px">Petit</option>
            <option value="14px">Normal</option>
            <option value="18px">Grand</option>
            <option value="24px">Très grand</option>
          </select>

          {/* Alignment */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().setTextAlign('left').run()
            }}
            className={cn(
              'px-2 py-1 text-xs rounded hover:bg-muted transition-colors',
              editor.isActive({ textAlign: 'left' }) && 'bg-muted'
            )}
            title="Aligner à gauche"
          >
            &#8676;
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().setTextAlign('center').run()
            }}
            className={cn(
              'px-2 py-1 text-xs rounded hover:bg-muted transition-colors',
              editor.isActive({ textAlign: 'center' }) && 'bg-muted'
            )}
            title="Centrer"
          >
            &#8596;
          </button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} className="px-3 py-2 min-h-[60px] text-sm" />
    </div>
  )
}
