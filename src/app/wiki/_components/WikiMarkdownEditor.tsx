"use client";

import React, { useEffect } from "react";
import cn from "classnames";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import {
  FeatherBold,
  FeatherCode,
  FeatherHeading1,
  FeatherHeading2,
  FeatherHeading3,
  FeatherItalic,
  FeatherLink,
  FeatherList,
  FeatherListOrdered,
  FeatherMinus,
  FeatherQuote,
  FeatherRedo,
  FeatherStrikethrough,
  FeatherUndo,
} from "@subframe/core";

interface WikiMarkdownEditorProps {
  /**
   * Initial Markdown body. Read ONCE on mount — the parent owns the value
   * afterwards via `onChange`, so we never push it back into the editor
   * (that would reset the cursor on every autosave round-trip).
   */
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
}

// tiptap-markdown registers `editor.storage.markdown` at runtime but does not
// augment TipTap's `Storage` type, so we read it through a narrow cast.
function readMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
}

// Applied to the contenteditable element. `prose` (via @tailwindcss/typography)
// renders the WYSIWYG headings/lists/quotes; the rest pins it to our tokens.
const EDITOR_CONTENT_CLASS = cn(
  "prose prose-sm max-w-none min-h-[24rem] focus:outline-none",
  "text-default-font",
  "prose-headings:text-default-font prose-headings:font-heading-3",
  "prose-p:text-default-font prose-li:text-default-font",
  "prose-strong:text-default-font prose-code:text-default-font",
  "prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline",
  "prose-blockquote:border-l-brand-600 prose-blockquote:text-subtext-color",
);

export function WikiMarkdownEditor({
  initialMarkdown,
  onChange,
  editable = true,
}: WikiMarkdownEditorProps) {
  const editor = useEditor({
    // Required for Next.js SSR: defer view creation to the client so the
    // server-rendered HTML and the first client render match.
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your document…",
      }),
      // `html: false` keeps the stored body as clean Markdown (no raw HTML),
      // which matches how the read-only view renders it.
      Markdown.configure({
        html: false,
        transformPastedText: true,
        linkify: true,
      }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: EDITOR_CONTENT_CLASS,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(readMarkdown(editor));
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div className="flex w-full flex-col">
      <WikiEditorToolbar editor={editor} />
      <div className="w-full px-4 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isStrike: boolean;
  isCode: boolean;
  isH1: boolean;
  isH2: boolean;
  isH3: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
  isLink: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

function WikiEditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState<ToolbarState | null>({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      return {
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isStrike: editor.isActive("strike"),
        isCode: editor.isActive("code"),
        isH1: editor.isActive("heading", { level: 1 }),
        isH2: editor.isActive("heading", { level: 2 }),
        isH3: editor.isActive("heading", { level: 3 }),
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        isBlockquote: editor.isActive("blockquote"),
        isLink: editor.isActive("link"),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      };
    },
  });

  const ready = Boolean(editor) && state !== null;

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return; // cancelled
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-solid border-neutral-border bg-default-background px-2 py-1.5">
      <ToolbarButton
        icon={<FeatherUndo />}
        label="Undo"
        disabled={!ready || !state?.canUndo}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={<FeatherRedo />}
        label="Redo"
        disabled={!ready || !state?.canRedo}
        onClick={() => editor?.chain().focus().redo().run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon={<FeatherHeading1 />}
        label="Heading 1"
        disabled={!ready}
        active={state?.isH1}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<FeatherHeading2 />}
        label="Heading 2"
        disabled={!ready}
        active={state?.isH2}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<FeatherHeading3 />}
        label="Heading 3"
        disabled={!ready}
        active={state?.isH3}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon={<FeatherBold />}
        label="Bold"
        disabled={!ready}
        active={state?.isBold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<FeatherItalic />}
        label="Italic"
        disabled={!ready}
        active={state?.isItalic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<FeatherStrikethrough />}
        label="Strikethrough"
        disabled={!ready}
        active={state?.isStrike}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        icon={<FeatherCode />}
        label="Inline code"
        disabled={!ready}
        active={state?.isCode}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon={<FeatherList />}
        label="Bullet list"
        disabled={!ready}
        active={state?.isBulletList}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<FeatherListOrdered />}
        label="Numbered list"
        disabled={!ready}
        active={state?.isOrderedList}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<FeatherQuote />}
        label="Quote"
        disabled={!ready}
        active={state?.isBlockquote}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon={<FeatherLink />}
        label="Link"
        disabled={!ready}
        active={state?.isLink}
        onClick={setLink}
      />
      <ToolbarButton
        icon={<FeatherMinus />}
        label="Divider"
        disabled={!ready}
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Prevent the editor from losing its selection when the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-body text-subtext-color transition-colors",
        "hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        { "bg-brand-50 text-brand-700 hover:bg-brand-100": active },
      )}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px flex-none bg-neutral-200" />;
}
