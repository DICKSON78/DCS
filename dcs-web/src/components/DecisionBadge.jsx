export default function DecisionBadge({ decision }) {
  if (!decision) return <span className="badge badge-neutral">Pending</span>;
  const map = {
    allow: "badge-allow",
    warn: "badge-warn",
    hold: "badge-hold",
    block: "badge-block",
  };
  return (
    <span className={"badge " + (map[decision] || "badge-neutral")}>
      <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
      {decision.toUpperCase()}
    </span>
  );
}