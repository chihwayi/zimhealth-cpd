import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const inputPath = path.resolve(process.cwd(), "Zimbabwe Health Councils CPD Overview.xlsx");

async function main() {
  const buf = await fs.readFile(inputPath);
  const wb = XLSX.read(buf, { type: "buffer" });

  const out = {
    workbook: path.basename(inputPath),
    sheetNames: wb.SheetNames,
    sheets: {},
  };

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
    // keep top-left slice for quick inspection
    const slice = rows.slice(0, 80).map((r) => (Array.isArray(r) ? r.slice(0, 20) : r));
    out.sheets[name] = { preview: slice };
  }

  await fs.writeFile(
    path.resolve(process.cwd(), "scripts/tmp/councils-xlsx-extract.json"),
    JSON.stringify(out, null, 2),
    "utf8",
  );
  console.log("Wrote scripts/tmp/councils-xlsx-extract.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

