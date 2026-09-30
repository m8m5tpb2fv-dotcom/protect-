/**
 * Hides contact details that a client typed into free text (order title/description) from providers
 * who have not been chosen yet. Orders are broadcast to every matching provider in the city, so a
 * phone in the description would otherwise leak to all of them. Contacts are revealed to the chosen
 * provider through the regular flow (contactPhone after assignment).
 */
export const HIDDEN_CONTACT = "[контакт скрыт]";

// a run of digits with the usual phone separators; validated by digit count below
const PHONE_CANDIDATE = /\+?\d[\d\s().\-‐–]{8,}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const MESSENGER_LINK = /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|api\.whatsapp\.com|vk\.com|vk\.me|viber\.click|max\.ru)\/[^\s,;)]+/gi;
const HANDLE = /(^|[\s(,:])@[a-z][\w]{3,31}\b/gi;

function isPhone(candidate: string) {
  const d = candidate.replace(/\D/g, "");
  // RU mobile/landline: +7 / 8 / 7 + 10 digits, or 10 digits starting with 9 (mobile without prefix)
  return (d.length === 11 && /^[78]/.test(d)) || (d.length === 10 && d.startsWith("9")) || (candidate.startsWith("+") && d.length >= 11 && d.length <= 13);
}

export function maskContacts(text: string) {
  return text
    .replace(MESSENGER_LINK, HIDDEN_CONTACT)
    .replace(EMAIL, HIDDEN_CONTACT)
    .replace(PHONE_CANDIDATE, (m) => (isPhone(m) ? HIDDEN_CONTACT : m))
    .replace(HANDLE, (_m, pre: string) => `${pre}${HIDDEN_CONTACT}`);
}
