export function LoadingLine() {
  return <div className="line" role="progressbar" aria-label="Loading" />;
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="loading">
      <LoadingLine />
      {label && <span>{label}</span>}
    </div>
  );
}
