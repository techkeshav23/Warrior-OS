// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: form dialog + confirm dialog
// Thin adapters over the kit's Dialog / ConfirmDialog (portal sheet,
// trapped focus, Esc closes, focus returns to the opener). The body is
// a <form>: Enter in a text field or Ctrl/Cmd+Enter anywhere in it runs
// `onSubmit`; the footer's <SubmitButton> joins the form by id.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  createContext,
  useContext,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Button,
  ConfirmDialog as KitConfirmDialog,
  Dialog,
  type ButtonProps,
  type DialogSize,
  type IconLike,
} from '@/components/ui';

const FormIdContext = createContext<string | undefined>(undefined);

interface DialogShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconLike;
  iconTone?: 'accent' | 'ember' | 'danger' | 'neutral';
  /** false plays the exit animation (the parent keeps the dialog mounted until the next one opens). */
  open?: boolean;
  onClose: () => void;
  /** Runs on submit: the footer's SubmitButton, Enter in a text field, or Ctrl/Cmd+Enter. */
  onSubmit?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: DialogSize;
  /** Unsaved input: a click on the backdrop no longer closes the dialog (Esc and Cancel still do). */
  dirty?: boolean;
  /** Field focused on open (default: the first focusable in the body). */
  initialFocus?: RefObject<HTMLElement | null>;
}

export function DialogShell({
  title,
  subtitle,
  icon,
  iconTone = 'accent',
  open = true,
  onClose,
  onSubmit,
  footer,
  children,
  size = 'lg',
  dirty = false,
  initialFocus,
}: DialogShellProps) {
  const formId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <FormIdContext.Provider value={formId}>
      <Dialog
        open={open}
        onClose={onClose}
        title={title}
        description={subtitle}
        icon={icon}
        iconTone={iconTone}
        size={size}
        footer={footer}
        closeOnBackdrop={!dirty}
        initialFocus={initialFocus}
        className="max-h-full"
        bodyClassName="@container"
      >
        <form id={formId} noValidate onSubmit={submit} onKeyDown={onKeyDown}>
          {children}
        </form>
      </Dialog>
    </FormIdContext.Provider>
  );
}

/** The dialog's submit button (primary by default). The footer sits outside the form, so it joins it by id. */
export function SubmitButton({ variant = 'primary', ...props }: Omit<ButtonProps, 'type' | 'form'>) {
  const formId = useContext(FormIdContext);
  return <Button type="submit" form={formId} variant={variant} {...props} />;
}

// ─── Confirm ───

export interface ConfirmRequest {
  title: string;
  /** One or two sentences naming the consequence (inline content only). */
  message: ReactNode;
  /** Optional block under the message, e.g. the card about to be deleted. */
  detail?: ReactNode;
  /** Label of the confirm button, e.g. "Delete deck". */
  confirmLabel: string;
  /** danger (default) for destructive actions. */
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
}

interface ConfirmDialogProps extends ConfirmRequest {
  open?: boolean;
  onClose: () => void;
}

/** Destructive confirm: focus starts on Cancel, so a stray Enter never destroys anything. */
export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  open = true,
  onClose,
}: ConfirmDialogProps) {
  // The sheet stays clickable while it animates out: confirm only once.
  const done = useRef(false);
  const confirm = () => {
    if (done.current) return;
    done.current = true;
    onConfirm();
    onClose();
  };
  return (
    <KitConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={title}
      description={message}
      confirmLabel={confirmLabel}
      tone={tone}
    >
      {detail}
    </KitConfirmDialog>
  );
}
