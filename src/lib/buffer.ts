type EncodedBuffer = Uint8Array & {
  toString(encoding?: string): string;
};

type BufferConstructor = {
  new (value: string | Uint8Array, encoding?: string): EncodedBuffer;
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

class BrowserBuffer extends Uint8Array {
  constructor(value: string | Uint8Array, encoding?: string) {
    super(
      typeof value === "string"
        ? encoding === "base64"
          ? Uint8Array.from(atob(value), character => character.charCodeAt(0))
          : new TextEncoder().encode(value)
        : value
    );
  }

  toString(encoding?: string): string {
    if (encoding === "base64") {
      return bytesToBase64(this);
    }
    if (encoding === "binary") {
      let binary = "";
      for (const byte of this) {
        binary += String.fromCharCode(byte);
      }
      return binary;
    }
    return new TextDecoder().decode(this);
  }
}

if (!globalThis.Buffer) {
  globalThis.Buffer = Object.assign(BrowserBuffer, {
    from: (value: string, encoding?: string) =>
      new BrowserBuffer(value, encoding),
  }) as unknown as BufferConstructor;
}
