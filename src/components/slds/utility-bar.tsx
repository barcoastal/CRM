"use client";

import Link from "next/link";
import { ListTodo, Phone, Zap } from "lucide-react";
import { useOptionalPhone } from "@/components/call-center/provider";
import { isTerminal } from "@/lib/call-center/model";
import styles from "./utility-bar.module.css";

export function UtilityBar() {
  const phone = useOptionalPhone();
  const callLabel = phone?.incoming ? "Incoming call" : phone?.active ? isTerminal(phone.active.status) ? "Wrap up" : "On call" : "CRM Phone";
  return (
    <nav className={styles.bar} aria-label="CRM utilities">
      <Link href="/sms"><Zap size={16} fill="currentColor" />SMS</Link>
      <Link href="/war-room"><Zap size={18} />Conversations View</Link>
      <Link href="/tasks?view=open"><ListTodo size={18} />To Do List</Link>
      {phone && <button className={styles.phone} aria-label="Open CRM phone" onClick={() => phone.setOpen(!phone.open)} aria-expanded={phone.open}>
        <Phone size={16} />{callLabel}<span className={phone.connected ? styles.connected : styles.offline} />
      </button>}
    </nav>
  );
}
