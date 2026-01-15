export class Ecc {
  static LOW: Ecc;
  static MEDIUM: Ecc;
  static QUARTILE: Ecc;
  static HIGH: Ecc;
}

export class QrCode {
  readonly size: number;
  static encodeText(text: string, ecl: Ecc): QrCode;
  getModules(): boolean[][];
}

