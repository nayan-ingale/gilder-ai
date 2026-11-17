import { redirect } from 'next/navigation';

/** /settings on its own opens the first tab. */
export default function SettingsPage() {
  redirect('/settings/general');
}
