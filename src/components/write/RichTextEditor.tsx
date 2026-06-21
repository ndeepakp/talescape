"use client";

import { useReducer } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

// Fonts offered in the toolbar. The value is the CSS font-family stack; the
// browser falls back gracefully if a given font isn't installed.
const FONTS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

function ToolbarButton({
  onClick,
  active,
  label,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor focus/selection
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={
        "flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm transition-colors " +
        (active
          ? "bg-accent text-accent-fg"
          : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800")
      }
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-300 bg-zinc-100 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
      <ToolbarButton
        label="B"
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="U"
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="S"
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

      <ToolbarButton
        label="“ ”"
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="• List"
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1. List"
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

      <ToolbarButton
        label="⇤"
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <ToolbarButton
        label="↔"
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <ToolbarButton
        label="⇥"
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <ToolbarButton
        label="≋"
        title="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      />

      <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

      <select
        title="Font"
        onMouseDown={(e) => e.stopPropagation()}
        value={
          FONTS.find((f) => f.value && editor.isActive("textStyle", { fontFamily: f.value }))
            ?.value ?? ""
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            editor.chain().focus().setFontFamily(v).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
        className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  // Toolbar buttons read editor.isActive(...). Those states change on selection
  // moves and mark toggles (e.g. clicking Bold with no selection), not just on
  // content edits — so force a re-render on every transaction to keep the
  // active highlight in sync.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const editor = useEditor({
    // Avoids an SSR hydration mismatch in the Next.js App Router.
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "richtext px-3 py-3 text-zinc-900 dark:text-zinc-100",
        "aria-label": placeholder ?? "Chapter text",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onTransaction: () => forceUpdate(),
  });

  return (
    <div className="richtext-editor overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
