const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]*)?(?:\(?\d{3}\)?[-.\s]*)?\d{3}[-.\s]*\d{4}\b/g;

export function scrubPossiblePii(input: string): string {
  return input.replace(emailRegex, "[email removed]").replace(phoneRegex, "[number removed]");
}
