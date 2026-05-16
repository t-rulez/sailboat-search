export default function StatusBadge({ status }) {
  if (!status || status === 'active') return null;

  const styles = {
    sold:    { label: 'Solgt',   cls: 'status-sold' },
    removed: { label: 'Fjernet', cls: 'status-removed' },
  };

  const s = styles[status] || { label: status, cls: 'status-removed' };

  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}
