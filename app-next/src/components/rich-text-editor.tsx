"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  disabled?: boolean;
  /** id used for label association */
  id?: string;
};

const isHtml = (v: string) => /<\/?[a-z][\s\S]*>/i.test(v);

/** Convert plain-text input (with newlines) into minimal HTML for Tiptap. */
function toInitialHtml(value: string): string {
  if (!value) return "";
  if (isHtml(value)) return value;
  // Plain text → wrap each non-empty line in <p>, blank lines become <p><br></p>
  return value
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
  className,
  disabled,
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start typing…",
      }),
    ],
    content: toInitialHtml(value),
    editorProps: {
      attributes: {
        id: id ?? "",
        class:
          "tiptap-content max-w-none focus:outline-none px-3 py-2 leading-relaxed",
        style: `min-height:${minHeight}px;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Tiptap returns "<p></p>" for empty editor — normalise to ""
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes (e.g. preset/load defaults) without breaking focus.
  React.useEffect(() => {
    if (!editor) return;
    const next = toInitialHtml(value);
    const current = editor.getHTML();
    if (next && current !== next && !editor.isFocused) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    if (!value && current && current !== "<p></p>" && !editor.isFocused) {
      editor.commands.clearContent(false);
    }
  }, [value, editor]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-input bg-background text-sm",
          className,
        )}
        style={{ minHeight: minHeight + 40 }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rich-editor rounded-md border border-input bg-background text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style jsx global>{`
        .tiptap-content { outline: none; }
        .tiptap-content p { margin: 0 0 0.5em; }
        .tiptap-content p:last-child { margin-bottom: 0; }
        .tiptap-content ul,
        .tiptap-content ol { padding-left: 1.25rem; margin: 0.25rem 0 0.5rem; }
        .tiptap-content ul { list-style: disc; }
        .tiptap-content ol { list-style: decimal; }
        .tiptap-content h2 { font-size: 1.05rem; font-weight: 600; margin: 0.6rem 0 0.3rem; }
        .tiptap-content h3 { font-size: 0.95rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .tiptap-content blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 0.75rem; color: hsl(var(--muted-foreground));
          margin: 0.5rem 0;
        }
        .tiptap-content a { color: hsl(var(--primary)); text-decoration: underline; }
        .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; color: hsl(var(--muted-foreground)); pointer-events: none; height: 0;
        }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    cn(
      "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
      active && "bg-accent text-foreground",
    );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
      <ToolbarButton
        title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Underline (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive("underline"))}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Sep />

      <ToolbarButton
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Sep />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Sep />

      <ToolbarButton
        title="Add / edit link"
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        className={btn(editor.isActive("link"))}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        className={btn(false)}
      >
        <Eraser className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          className={btn(false)}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          className={btn(false)}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  className,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(className, disabled && "opacity-40 cursor-not-allowed")}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />;
}

/**
 * Convert HTML produced by the rich text editor into plain text suitable for
 * server-side renderers (e.g. PDF generator). Preserves paragraph breaks and
 * list bullets.
 */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  if (!/<\/?[a-z]/i.test(html)) return html.trim();
  let s = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Collapse 3+ newlines and trim trailing whitespace per line
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
