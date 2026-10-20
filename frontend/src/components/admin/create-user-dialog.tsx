'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api/client';
import { adminApi, type CreatedUser } from '@/lib/api/endpoints';
import { createUserSchema, fieldErrors } from '@/lib/validation';

export function CreateUserDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (user: CreatedUser) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createUserSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error) as Record<string, string>);
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const created = await adminApi.createUser(parsed.data);
      onClose();
      onCreated(created);
    } catch (err) {
      setFormError(err instanceof ApiError && err.status === 409 ? 'That username is taken.' : 'Couldn’t create the user. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create user">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input name="username" label="Username" autoCapitalize="none" spellCheck={false} helper="3–24 lowercase letters, numbers or underscores." error={errors.username} />
        <Input name="displayName" label="Display name" error={errors.displayName} />
        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Create user</Button>
        </div>
      </form>
    </Modal>
  );
}
