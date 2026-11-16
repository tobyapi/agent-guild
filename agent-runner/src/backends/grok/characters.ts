export function controls(text: string, includeSpace = false): boolean {
  return Array.from(text).some(char => char.charCodeAt(0) < (includeSpace ? 33 : 32) || char.charCodeAt(0) === 127);
}
