import { useEffect } from "react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
