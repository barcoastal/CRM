"use client";

/**
 * TipTap-based WYSIWYG editor for email template bodies + ad-hoc composers.
 *
 * Renders a Salesforce-flavored toolbar (bold / italic / underline / lists /
 * headings / link / clear / merge field) and emits HTML through onChange.
 *
 * Merge fields are inserted as plain text tokens like "{{lead.firstName}}"
 * at the cursor. The send pipeline already resolves these via mergeTokens.
 *
 * Stays fully controlled-ish: when the `value` prop changes from outside
 * (e.g. when the user picks a different template to edit) we sync the
 * editor's internal doc; otherwise we let TipTap drive its own state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  DEFAULT_MERGE_CONTEXTS,
  MERGE_CONTEXT_LABELS,
  MERGE_FIELDS_BY_CONTEXT,
  flattenMergeFields,
  type MergeField,
  type MergeFieldWithContext,
} from "@/lib/email/merge-fields";

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Pass-through list of merge fields shown in the picker. If omitted, the
   *  default catalog (lead/opportunity/account/user/system) is used. */
  mergeFields?: MergeField[] | MergeFieldWithContext[];
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  /** Disable interaction (read-only preview). */
  disabled?: boolean;
}

export function RichEditor({
  value,
  onChange,
  mergeFields,
  placeholder = "Write your email body. Use Insert Merge Field for personalization.",
  minHeight = 320,
  maxHeight = 600,
  disabled = false,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-editor-surface",
      },
    },
  });

  // External value changes (e.g. picking a different template) should reset
  // editor doc. We compare with the current HTML to avoid clobbering the user.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value === current) return;
    // setContent will fire onUpdate which would echo back — pass emitUpdate false
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        style={{
          minHeight,
          maxHeight,
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          background: "#fafaf9",
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #c9c9c9", borderRadius: 4 }}>
      <Toolbar editor={editor} mergeFields={mergeFields} disabled={disabled} />
      <div
        style={{
          minHeight,
          maxHeight,
          overflowY: "auto",
          padding: "12px 14px",
          background: "#fff",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#181818",
        }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .rich-editor-surface {
          outline: none;
          min-height: 100%;
        }
        .rich-editor-surface p {
          margin: 0 0 0.7em 0;
        }
        .rich-editor-surface h1,
        .rich-editor-surface h2,
        .rich-editor-surface h3 {
          margin: 0.5em 0 0.4em 0;
          font-weight: 700;
          color: #181818;
        }
        .rich-editor-surface h1 {
          font-size: 20px;
        }
        .rich-editor-surface h2 {
          font-size: 17px;
        }
        .rich-editor-surface h3 {
          font-size: 15px;
        }
        .rich-editor-surface ul,
        .rich-editor-surface ol {
          padding-left: 22px;
          margin: 0 0 0.7em 0;
        }
        .rich-editor-surface a {
          color: #0176d3;
          text-decoration: underline;
        }
        .rich-editor-surface p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #adacaa;
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  mergeFields?: MergeField[] | MergeFieldWithContext[];
  disabled: boolean;
}

function Toolbar({ editor, mergeFields, disabled }: ToolbarProps) {
  const [mergeOpen, setMergeOpen] = useState(false);

  const onSetLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertMerge = useCallback(
    (key: string) => {
      editor.chain().focus().insertContent(`{{${key}}}`).run();
      setMergeOpen(false);
    },
    [editor],
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: "6px 8px",
        borderBottom: "1px solid #ecebea",
        background: "#fafaf9",
        position: "relative",
      }}
    >
      <Btn
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled}
      >
        <strong>B</strong>
      </Btn>
      <Btn
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled}
      >
        <em>I</em>
      </Btn>
      <Btn
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={disabled}
      >
        <span style={{ textDecoration: "underline" }}>U</span>
      </Btn>
      <Sep />
      <Btn
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={disabled}
      >
        H1
      </Btn>
      <Btn
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={disabled}
      >
        H2
      </Btn>
      <Btn
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={disabled}
      >
        H3
      </Btn>
      <Sep />
      <Btn
        title="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={disabled}
      >
        &bull; List
      </Btn>
      <Btn
        title="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
      >
        1. List
      </Btn>
      <Sep />
      <Btn title="Insert link" active={editor.isActive("link")} onClick={onSetLink} disabled={disabled}>
        Link
      </Btn>
      <Btn
        title="Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        disabled={disabled}
      >
        Clear
      </Btn>
      <Sep />
      <Btn title="Insert merge field" onClick={() => setMergeOpen((v) => !v)} disabled={disabled}>
        {"{{ }}"} Merge Field
      </Btn>

      {mergeOpen && (
        <MergeFieldPicker
          fields={mergeFields}
          onSelect={insertMerge}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: active ? "#dceaff" : "transparent",
        border: 0,
        color: "#181818",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        height: 26,
        minWidth: 28,
        padding: "0 8px",
        borderRadius: 3,
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: "#c9c9c9", margin: "0 4px", alignSelf: "center" }} />;
}

interface MergeFieldPickerProps {
  fields?: MergeField[] | MergeFieldWithContext[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

function MergeFieldPicker({ fields, onSelect, onClose }: MergeFieldPickerProps) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Build groups: if caller passed a custom list with `context`, honor that;
  // otherwise expand the default catalog.
  const groups: Array<{ context: string; label: string; items: MergeField[] }> = useMemo(() => {
    if (fields && fields.length > 0) {
      const hasContext = fields.some((f) => "context" in f && typeof f.context === "string");
      if (hasContext) {
        const byCtx = new Map<string, MergeField[]>();
        for (const f of fields as MergeFieldWithContext[]) {
          const arr = byCtx.get(f.context) ?? [];
          arr.push({ key: f.key, label: f.label });
          byCtx.set(f.context, arr);
        }
        return Array.from(byCtx.entries()).map(([context, items]) => ({
          context,
          label: MERGE_CONTEXT_LABELS[context] ?? context,
          items,
        }));
      }
      return [
        {
          context: "custom",
          label: "Fields",
          items: fields as MergeField[],
        },
      ];
    }
    return DEFAULT_MERGE_CONTEXTS.filter((c) => MERGE_FIELDS_BY_CONTEXT[c]).map((c) => ({
      context: c,
      label: MERGE_CONTEXT_LABELS[c] ?? c,
      items: MERGE_FIELDS_BY_CONTEXT[c],
    }));
  }, [fields]);

  const flat = useMemo(() => {
    if (fields && fields.length > 0) {
      const hasContext = fields.some((f) => "context" in f && typeof f.context === "string");
      if (hasContext) return fields as MergeFieldWithContext[];
      return (fields as MergeField[]).map((f) => ({ ...f, context: "custom" }));
    }
    return flattenMergeFields(DEFAULT_MERGE_CONTEXTS);
  }, [fields]);

  const filteredFlat = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return flat.filter((f) => f.key.toLowerCase().includes(needle) || f.label.toLowerCase().includes(needle));
  }, [q, flat]);

  // Click outside to close
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        right: 8,
        marginTop: 4,
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        width: 280,
        maxHeight: 320,
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <div style={{ padding: 8, borderBottom: "1px solid #ecebea", background: "#fafaf9" }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search merge fields"
          style={{
            width: "100%",
            border: "1px solid #c9c9c9",
            borderRadius: 3,
            padding: "4px 8px",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>
      <div>
        {filteredFlat ? (
          filteredFlat.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: "#747474" }}>No matches</div>
          ) : (
            filteredFlat.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onSelect(f.key)}
                style={pickerItemStyle}
              >
                <span style={{ fontSize: 12, color: "#181818" }}>{f.label}</span>
                <span style={{ fontSize: 11, color: "#747474", fontFamily: "monospace" }}>{`{{${f.key}}}`}</span>
              </button>
            ))
          )
        ) : (
          groups.map((g) => (
            <div key={g.context}>
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: 10,
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  color: "#747474",
                  background: "#fafaf9",
                  borderBottom: "1px solid #ecebea",
                }}
              >
                {g.label}
              </div>
              {g.items.map((f) => (
                <button key={f.key} type="button" onClick={() => onSelect(f.key)} style={pickerItemStyle}>
                  <span style={{ fontSize: 12, color: "#181818" }}>{f.label}</span>
                  <span style={{ fontSize: 11, color: "#747474", fontFamily: "monospace" }}>{`{{${f.key}}}`}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const pickerItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  background: "transparent",
  border: 0,
  borderBottom: "1px solid #f4f4f4",
  cursor: "pointer",
  gap: 2,
};
