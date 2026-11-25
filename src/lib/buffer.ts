type EncodedBuffer = {
  toString(encoding?: string): string;
};

type BufferConstructor = {
  from(value: string, encoding?: string): EncodedBuffer;
};

declare global {
  var Buffer: BufferConstructor | undefined;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

if (!globalThis.Buffer) {
  globalThis.Buffer = {
    from(value, encoding) {
      const bytes =
        encoding === "base64"
          ? Uint8Array.from(atob(value), character => character.charCodeAt(0))
          : new TextEncoder().encode(value);
      return {
        toString(outputEncoding) {
          return outputEncoding === "base64"
            ? bytesToBase64(bytes)
            : new TextDecoder().decode(bytes);
        },
      };
    },
  };
}
