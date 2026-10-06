import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GeheimFout, leesSleutel, ontsleutel, versleutel } from "./geheim.js";

const sleutel = randomBytes(32);

describe("stekker-secrets versleutelen", () => {
  it("versleutelt en ontsleutelt; de opgeslagen vorm bevat het secret niet", () => {
    const opgeslagen = versleutel("geheim-123", sleutel);
    expect(opgeslagen).toMatch(/^v1:/);
    expect(opgeslagen).not.toContain("geheim-123");
    expect(ontsleutel(opgeslagen, sleutel)).toBe("geheim-123");
  });

  it("geeft elke keer een andere versleuteling (eigen iv)", () => {
    expect(versleutel("x", sleutel)).not.toBe(versleutel("x", sleutel));
  });

  it("weigert met een verkeerde sleutel of gewijzigde data, zonder het secret te noemen", () => {
    const opgeslagen = versleutel("geheim-123", sleutel);
    expect(() => ontsleutel(opgeslagen, randomBytes(32))).toThrow(GeheimFout);
    const gewijzigd = `v1:${Buffer.from(Buffer.from(opgeslagen.slice(3), "base64").map((b, i) => (i === 20 ? b ^ 1 : b))).toString("base64")}`;
    expect(() => ontsleutel(gewijzigd, sleutel)).toThrow(/ontsleuteld/);
  });

  it("controleert de sleutel", () => {
    expect(leesSleutel(sleutel.toString("base64"))).toHaveLength(32);
    expect(() => leesSleutel(undefined)).toThrow(/SECRET_ENCRYPTION_KEY/);
    expect(() => leesSleutel(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
