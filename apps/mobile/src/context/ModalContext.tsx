import { createContext, useCallback, useContext, useState } from 'react';
import { AppModal } from '../components/ui/AppModal';
import { AppToast } from '../components/ui/AppToast';
import type { ModalType } from '../components/ui/AppModal';
import type { ToastType } from '../components/ui/AppToast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AlertOpts {
  title: string;
  message?: string;
  type?: ModalType;
  confirmLabel?: string;
  onConfirm?: () => void;
}

interface ConfirmOpts {
  title: string;
  message?: string;
  type?: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastOpts {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ModalContextValue {
  showAlert:   (opts: AlertOpts)   => void;
  showConfirm: (opts: ConfirmOpts) => void;
  showToast:   (opts: ToastOpts)   => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue | null>(null);

// ── Internal state shapes ─────────────────────────────────────────────────────

interface ModalState {
  visible: boolean;
  type: ModalType;
  title: string;
  message?: string;
  buttons: { label: string; onPress: () => void; variant?: 'primary' | 'danger' | 'cancel' }[];
}

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

const DEFAULT_MODAL: ModalState = { visible: false, type: 'info', title: '', buttons: [] };
const DEFAULT_TOAST: ToastState = { visible: false, message: '', type: 'info', duration: 3000 };

// ── Provider ──────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(DEFAULT_MODAL);
  const [toast, setToast] = useState<ToastState>(DEFAULT_TOAST);

  const dismissModal = useCallback(() => setModal((m) => ({ ...m, visible: false })), []);
  const dismissToast = useCallback(() => setToast((t) => ({ ...t, visible: false })), []);

  const showAlert = useCallback((opts: AlertOpts) => {
    setModal({
      visible: true,
      type: opts.type ?? 'info',
      title: opts.title,
      message: opts.message,
      buttons: [
        {
          label: opts.confirmLabel ?? 'OK',
          variant: 'primary',
          onPress: () => { opts.onConfirm?.(); },
        },
      ],
    });
  }, []);

  const showConfirm = useCallback((opts: ConfirmOpts) => {
    setModal({
      visible: true,
      type: opts.type ?? 'warning',
      title: opts.title,
      message: opts.message,
      buttons: [
        {
          label: opts.cancelLabel ?? 'Cancel',
          variant: 'cancel',
          onPress: () => { opts.onCancel?.(); },
        },
        {
          label: opts.confirmLabel ?? 'Confirm',
          variant: opts.type === 'danger' ? 'danger' : 'primary',
          onPress: () => { opts.onConfirm(); },
        },
      ],
    });
  }, []);

  const showToast = useCallback((opts: ToastOpts) => {
    // reset first so re-trigger of same message works
    setToast({ visible: false, message: '', type: 'info', duration: 3000 });
    requestAnimationFrame(() => {
      setToast({
        visible: true,
        message: opts.message,
        type: opts.type ?? 'info',
        duration: opts.duration ?? 3000,
      });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}
      <AppModal
        visible={modal.visible}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        buttons={modal.buttons}
        onDismiss={dismissModal}
      />
      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onHide={dismissToast}
      />
    </ModalContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
  return ctx;
}
