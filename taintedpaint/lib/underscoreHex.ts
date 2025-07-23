export function decodeUnderscoreHex(input: string): string {
  return input.replace(/(?:_[0-9A-Fa-f]{2})+/g, seq => {
    const hex = seq.replace(/_/g, '');
    try {
      return Buffer.from(hex, 'hex').toString('utf8');
    } catch {
      return seq;
    }
  });
}
