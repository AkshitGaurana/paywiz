import type { ChatMessage } from "../schemas";

type TransferDetails = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
};

function includesAmount(text: string, amount: number): boolean {
  const amounts = [...text.matchAll(/(?:₹\s*|rs\.?\s*|rupees?\s+)([\d,]+(?:\.\d{1,2})?)/gi)]
    .map((match) => Number(match[1].replaceAll(",", "")));
  return amounts.some((candidate) => candidate === amount);
}

function includesAccounts(text: string, details: TransferDetails): boolean {
  const normalized = text.toLowerCase();
  const from = details.from_account_id.toLowerCase();
  const to = details.to_account_id.toLowerCase();
  return normalized.includes(from) && normalized.includes(to);
}

export function isTransferConfirmed(
  messages: ChatMessage[],
  details: TransferDetails
): boolean {
  const current = messages.at(-1);
  const priorAssistant = messages.slice(0, -1).reverse().find((message) => message.role === "model");
  if (!current || current.role !== "user" || !priorAssistant) return false;

  const explicitConfirmation = /\b(confirm|confirmed|yes|proceed|go ahead|approve)\b/i;
  return (
    explicitConfirmation.test(current.text) &&
    /\bconfirm(?:ation)?\b/i.test(priorAssistant.text) &&
    [current.text, priorAssistant.text].every(
      (text) => includesAmount(text, details.amount) && includesAccounts(text, details)
    )
  );
}
