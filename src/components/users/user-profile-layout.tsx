/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./user-profile-layout.module.css";

type RelatedItem = { id: string; name: string; href: string; avatar?: string | null };
export interface ProfilePerson {
  id: string; name: string; email: string; avatar?: string | null; title?: string | null;
  companyDisplay?: string | null; mobile?: string | null; extension?: string | null;
  country?: string | null; userCountry?: string | null; street?: string | null; city?: string | null; state?: string | null; postalCode?: string | null;
  manager?: { id: string; name: string } | null;
}
const fallbackAvatar = "/slds/images/profile_avatar_200.png";
function Field({ label, children }: { label: string; children?: ReactNode }) {
  return <div className={styles.field}><span className={styles.label}>{label}</span><span className={styles.value}>{children}</span></div>;
}
function Related({ label, icon, items }: { label: string; icon: string; items: RelatedItem[] }) {
  return <details className={styles.related} open={items.length > 0}>
    <summary><span className={styles.icon}><svg aria-hidden="true"><use href={`/slds/icons/standard-sprite/svg/symbols.svg#${icon}`} /></svg></span>{label} ({items.length})</summary>
    {items.length ? items.map(item => <div key={item.id} className={styles.item}>{(label === "Followers" || label === "Following") && <img src={item.avatar || fallbackAvatar} alt="" />}<Link href={item.href}>{item.name}</Link></div>) : <p className={styles.empty}>No {label.toLowerCase()}.</p>}
  </details>;
}
export function UserProfileLayout({ user, actions, related, posts, children }: {
  user: ProfilePerson; actions: ReactNode; children: ReactNode;
  related: { files: RelatedItem[]; groups: RelatedItem[]; followers: RelatedItem[]; following: RelatedItem[] };
  posts: Array<{ id: string; body: string; createdAt: Date; author: { name: string } }>;
}) {
  const address = [user.street, user.city, user.state, user.postalCode, user.country].filter(Boolean).join(", ");
  return <div className={styles.profile}>
    <div className={styles.banner} role="img" aria-label="Mountain landscape and hot-air balloon" />
    <header className={styles.identity}>
      <img className={styles.avatar} src={user.avatar || fallbackAvatar} alt={`${user.name} profile photo`} />
      <div className={styles.heading}><h1 className={styles.name}>{user.name}</h1><div className={styles.actions}>{actions}</div></div>
      <p className={styles.subtitle}>{user.title || ""}</p>
    </header>
    <div className={styles.columns}>
      <main>
        <section className={styles.card} aria-label="Profile details">
          <h2 className={styles.tab}><span>Details</span></h2>
          <details className={styles.section} open><summary>About</summary><div className={styles.fields}>
            <Field label="Name">{user.name}</Field><Field label="Title">{user.title}</Field>
            <Field label="Manager">{user.manager && <Link href={`/settings/users/${user.manager.id}`}>{user.manager.name}</Link>}</Field><Field label="Company Name">{user.companyDisplay}</Field>
          </div></details>
          <details className={styles.section} open><summary>Contact</summary><div className={styles.fields}>
            <Field label="Email"><a href={`mailto:${user.email}`}>{user.email}</a></Field><Field label="Phone">{user.extension ? `Ext. ${user.extension}` : ""}</Field>
            <Field label="Mobile">{user.mobile && <a href={`tel:${user.mobile}`}>{user.mobile}</a>}</Field><Field label="Address">{address}</Field>
            <Field label="User Country">{user.userCountry}</Field>
          </div></details>
          <details className={styles.section} open><summary>Background</summary><div className={styles.fields}><Field label="About Me" /></div></details>
        </section>
        <section className={styles.card} aria-label="Chatter"><h2 className={styles.tab}><span>Chatter</span></h2>
          {posts.length ? posts.map(post => <article key={post.id} className={styles.post}><strong>{post.author.name}</strong><time>{post.createdAt.toLocaleString()}</time><p>{post.body}</p></article>) : <p className={styles.empty}>No profile posts yet.</p>}
        </section>
        <section className={styles.card} aria-label="User work and history"><h2 className={styles.tab}><span>Work &amp; Activity</span></h2><div className={styles.work}>{children}</div></section>
      </main>
      <aside className={styles.card} aria-label="Related"><h2 className={styles.tab}><span>Related</span></h2>
        <Related label="Files" icon="file" items={related.files} /><Related label="Groups" icon="groups" items={related.groups} /><Related label="Followers" icon="user" items={related.followers} /><Related label="Following" icon="user" items={related.following} />
      </aside>
    </div>
  </div>;
}
