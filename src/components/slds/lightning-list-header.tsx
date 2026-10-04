"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { UtilityIcon } from "./icon";
import { SfHeaderAction, SfListSearch } from "./sf-list-client";
import type { SfListAction } from "./sf-list-page";
import styles from "./lightning-list.module.css";

export function LightningListHeader({ title, subtitle, iconSlug, count, countLabel, actions, controls, viewPicker, pathname, preservedParams, searchQuery }: {
  title: string; subtitle: string; iconSlug: string; count: number; countLabel: string;
  actions: SfListAction[]; controls: ReactNode; viewPicker?: ReactNode;
  pathname: string; preservedParams: Record<string, string>; searchQuery: string;
}) {
  const overflow = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (overflow.current && !overflow.current.contains(event.target as Node)) overflow.current.open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const renderAction = (action: SfListAction) => action.href ? (
    <Link key={action.label} href={action.href} className={styles.action}>{action.label}</Link>
  ) : (
    <SfHeaderAction key={action.label} label={action.label}><span className={styles.action}>{action.label}</span></SfHeaderAction>
  );

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <span className={styles.objectIcon} aria-hidden="true">
          <svg><use href={`/slds/icons/standard-sprite/svg/symbols.svg#${iconSlug}`} /></svg>
        </span>
        <div>
          <div className={styles.objectName}>{title}</div>
          {viewPicker ?? <h1 className={styles.viewName}>{subtitle}</h1>}
        </div>
      </div>
      <div className={styles.actions} aria-label={`${title} actions`}>
        {actions.slice(0, 5).map(renderAction)}
        {actions.length > 5 && (
          <details ref={overflow} className={styles.moreActions} onKeyDown={event => {
            if (event.key === "Escape" && overflow.current) {
              overflow.current.open = false;
              overflow.current.querySelector("summary")?.focus();
            }
          }}>
            <summary aria-label="More actions" title="More actions"><UtilityIcon name="down" /></summary>
            <div className={styles.actionMenu} onClick={() => { if (overflow.current) overflow.current.open = false; }}>
              {actions.slice(5).map(renderAction)}
            </div>
          </details>
        )}
      </div>
      <div className={styles.count} aria-live="polite">
        {countLabel} item{count === 1 ? "" : "s"} <span>· Updated just now</span>
      </div>
      <div className={styles.tools}>
        <SfListSearch pathname={pathname} preservedParams={preservedParams} initialValue={searchQuery} />
        {controls}
      </div>
    </header>
  );
}
