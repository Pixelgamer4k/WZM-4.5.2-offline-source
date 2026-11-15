// Frida's explicit UTF-8 length counts bytes, including bytes beyond a NUL.
export function readBoundedUtf8(address, limit) {
  if (address.isNull()) return '';
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid string limit');
  const range = Process.findRangeByAddress(address);
  if (!range || !range.protection.includes('r')) throw new Error('Unreadable string');
  const end = range.base.add(range.size);
  const capacity = address.add(limit).compare(end) <= 0 ? limit : end.sub(address).toUInt32();
  const bytes = new Uint8Array(address.readByteArray(capacity));
  const nul = bytes.indexOf(0);
  const length = nul === -1 ? bytes.length : nul;
  return length ? address.readUtf8String(length) : '';
}
