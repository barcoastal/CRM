"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Maximize2, MessageCircle, Minimize2, Minus } from "lucide-react";
import styles from "./chat-dock.module.css";

const ChatInbox = dynamic(
  () => import("@/app/(dashboard)/google-chat/chat-inbox").then(module => module.ChatInbox),
  { ssr: false, loading: () => <p className={styles.loading} role="status">Loading Google Chat…</p> },
);

export function ChatDock({ account }: { account: { id: string; name: string; email: string } }) {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const onChatPage = pathname === "/google-chat";
  const visible = opened && !onChatPage;

  function minimize() {
    setOpened(false);
    launcher.current?.focus();
  }

  return <div className={styles.dock} hidden={onChatPage}>
    <button
      ref={launcher}
      type="button"
      className={styles.launcher}
      aria-controls="google-chat-dock"
      aria-expanded={visible}
      onClick={() => { setMounted(true); setOpened(value => !value); }}
    >
      <MessageCircle size={18} aria-hidden="true" /> Google Chat
    </button>
    {mounted && <section
      id="google-chat-dock"
      className={`${styles.panel} ${expanded ? styles.expanded : ""}`}
      hidden={!visible}
      aria-label="Google Chat panel"
      onKeyDown={event => {
        if (event.key === "Escape" && !(event.target as HTMLElement).closest('[role="dialog"]')) {
          event.preventDefault();
          minimize();
        }
      }}
    >
      <header className={styles.titlebar}>
        <MessageCircle size={18} aria-hidden="true" />
        <strong>Google Chat</strong>
        <button type="button" aria-label={expanded ? "Shrink chat window" : "Expand chat window"} title={expanded ? "Shrink" : "Expand"} onClick={() => setExpanded(value => !value)}>
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <button type="button" aria-label="Minimize Google Chat" title="Minimize" onClick={minimize}><Minus size={20} /></button>
      </header>
      <div className={styles.content}>
        <ChatInbox account={account} embedded compact={!expanded} active={visible} />
      </div>
    </section>}
  </div>;
}
