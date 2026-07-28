/**
 * Escape text for interpolation into the HTML email templates.
 *
 * Kept out of the "use server" action modules: everything exported from those
 * must be an async Server Action, and this is a plain synchronous helper.
 */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
