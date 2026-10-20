'use client';
import { UserButton } from '@clerk/nextjs';

/** Clerk's account menu (profile, security, sign out). Loaded lazily by Topbar. */
export function AdminMenu() {
  return (
    <div className="glass grid h-11 w-11 place-items-center !rounded-full">
      <UserButton appearance={{ elements: { avatarBox: 'h-9 w-9' } }} />
    </div>
  );
}
