/**
 * Central mapping from API failures to user-facing copy. Server `code`s win,
 * then HTTP status; otherwise the server-provided message is passed through.
 */
export const CLAIM_MAYBE_RECEIVED_MESSAGE =
  'Your claim may have been received. Check your Claims history before submitting again.';

export function retryAfterText(retryAfterSeconds?: number | null): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return 'in a moment';
  if (retryAfterSeconds < 60) return `in ${Math.ceil(retryAfterSeconds)} seconds`;
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

const CODE_MESSAGES: Record<string, string> = {
  submission_conflict:
    'This submission was already used with different details. Go back, review your claim, and try again.',
  active_claim_exists:
    'You already have an active claim in progress. Wait for it to be resolved or check your Claims history.',
  duplicate_claim:
    'A claim for this visit has already been filed. Check your Claims history.',
  eligible_card_required:
    'An eligible, active ER Guard card is required to file a claim.',
  invoice_claims_disabled: 'Reimbursement claims are not available right now. Please try again later.',
  invoice_ai_unavailable:
    'Invoice reading is temporarily unavailable. You can still enter the details manually.',
};

export function friendlyMessage(
  status?: number,
  code?: string,
  serverMessage?: string,
  retryAfterSeconds?: number,
  nonJson = false,
): string {
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (status === 413) return 'The files are too large. Use fewer or smaller photos and try again.';
  if (status === 429) return `Too many attempts. Please try again ${retryAfterText(retryAfterSeconds)}.`;
  if (nonJson && status && status >= 500) {
    return 'The server is having trouble right now. Please try again shortly.';
  }
  if (nonJson && status && status >= 400) return `Request failed (${status}). Please try again.`;
  if (status === 503 && !serverMessage) return 'The service is temporarily unavailable. Please try again shortly.';
  return serverMessage || (status ? `Request failed (${status})` : 'Something went wrong. Please try again.');
}
