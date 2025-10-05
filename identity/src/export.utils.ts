import crypto from "node:crypto";
import stringify from "fast-json-stable-stringify";

export function sha256(buf: Buffer | string) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
export function hmac256(secret: string, data: string | Buffer) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
export function stableJson(obj: any) {
  return stringify(obj);
}
