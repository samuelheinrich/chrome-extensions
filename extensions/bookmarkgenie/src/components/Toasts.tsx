export type ToastMessage = {
  id: number;
  message: string;
  type?: "info" | "success" | "warning" | "error";
};

type ToastsProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

export const Toasts = ({ toasts, onDismiss }: ToastsProps) => (
  <div className="toast-stack" aria-live="polite">
    {toasts.map((toast) => (
      <button key={toast.id} className={`toast ${toast.type ?? "info"}`} onClick={() => onDismiss(toast.id)}>
        {toast.message}
      </button>
    ))}
  </div>
);
