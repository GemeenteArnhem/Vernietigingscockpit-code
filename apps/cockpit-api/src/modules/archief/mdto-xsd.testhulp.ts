import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Validatie van MDTO-XML tegen de officiële XSD van het Nationaal Archief (MDTO-XML 1.0.1),
// via Python + lxml, zoals in de teststekker. Ontbreekt dat, dan geeft de functie `null`
// terug en slaat de aanroeper de controle over.

// De XSD staat bij de tests (test/mdto); dit bestand hoort niet in de build (tsconfig.build.json).
const XSD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../test/mdto/MDTO-XML1.0.1.xsd");

const SCRIPT = [
  "import sys",
  "from lxml import etree",
  "schema = etree.XMLSchema(etree.parse(sys.argv[1]))",
  "fouten = []",
  "for pad in sys.argv[2:]:",
  "    if not schema.validate(etree.parse(pad)):",
  "        fouten.append(pad + ': ' + '; '.join(str(e) for e in schema.error_log))",
  'print("\\n".join(fouten))',
  "sys.exit(1 if fouten else 0)",
].join("\n");

// Geeft per ongeldig document een foutregel, [] als alles geldig is, of null zonder lxml.
export function valideerMdto(documenten: Record<string, string | Buffer>): string[] | null {
  const map = mkdtempSync(path.join(tmpdir(), "mdto-"));

  try {
    const paden = Object.entries(documenten).map(([naam, inhoud], index) => {
      const pad = path.join(map, `${index}-${naam.replaceAll(/[^\w.-]/g, "_")}`);
      writeFileSync(pad, inhoud);
      return pad;
    });

    for (const python of ["python3", "python"]) {
      const resultaat = spawnSync(python, ["-c", SCRIPT, XSD, ...paden], { encoding: "utf8" });

      if (resultaat.error || resultaat.status === null || /No module named|not found|Python was not found/i.test(resultaat.stderr ?? "")) {
        continue;
      }

      return resultaat.status === 0 ? [] : `${resultaat.stdout}${resultaat.stderr}`.trim().split("\n");
    }

    return null;
  } finally {
    rmSync(map, { recursive: true, force: true });
  }
}
