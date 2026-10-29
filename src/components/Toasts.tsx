import { useToasts } from "../lib/toast";

export function Toasts() {
  const items = useToasts((state) => state.items);
  return (
    <div className="toast-layer" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div className="toast" key={item.id} role="status">
          {item.message}
        </div>
      ))}
    </div>
  );
}
