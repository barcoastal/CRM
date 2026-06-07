export function MsTitleBar({ title }: { title: string }) {
  return (
    <div className="ms-title-bar">
      <svg className="ms-title-bar-icon" aria-hidden="true">
        <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#settings" />
      </svg>
      <span className="ms-title-bar-text">{title}</span>
    </div>
  );
}
