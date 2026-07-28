/**
 * Input/label styling for the login and signup pages only.
 *
 * These pages are deliberately theme-independent — always the branded blue
 * wave, always a white card — because dark slate text and near-black inputs
 * disappear against that backdrop. The shared `inputClass`/`labelClass` in
 * components/ui.tsx still carry `dark:` variants (correctly, for every other
 * page that follows the system theme), so reusing them here means the card
 * stays forced-light while the controls inside it flip dark under a dark
 * system theme. These variants never do that.
 */
export const authInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none";

export const authLabelClass = "mb-1.5 block text-xs font-medium text-slate-600";
