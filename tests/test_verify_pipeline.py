import subprocess
import unittest
from pathlib import Path

from scripts.verify_pipeline import contains_test_marker


class VerifyPipelineTests(unittest.TestCase):
    def test_financial_engine_calculates_working_capital_and_flags(self) -> None:
        root = Path(__file__).resolve().parent.parent
        script = r"""
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules/typescript"));
const Module = require("module");
const sourcePath = path.join(process.cwd(), "lib/analytics/financialEngine.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = new Module(sourcePath, module);
mod.paths = Module._nodeModulePaths(process.cwd());
mod._compile(output, sourcePath + ".js");
const calculate = mod.exports.calculateFinancialMetrics;
const vouchers = [
  {id:"1", company_id:"a", voucher_number:"DUP", voucher_type:"sales", voucher_date:"2026-10-01", party_name:"Client", party_gstin:"GST1", total_amount:60000, sales_amount:60000},
  {id:"2", company_id:"a", voucher_number:"DUP", voucher_type:"sales", voucher_date:"2026-10-02", party_name:"Client", party_gstin:"GST1", total_amount:100, sales_amount:100},
  {id:"3", company_id:"a", voucher_number:"B2B", voucher_type:"sales", voucher_date:"2026-10-03", total_amount:75000, sales_amount:75000},
  {id:"4", company_id:"a", voucher_number:"PAY", voucher_type:"payment", voucher_date:"2026-10-04", total_amount:200, amount:200},
  {id:"5", company_id:"a", voucher_number:"OUTLIER", voucher_type:"sales", voucher_date:"2026-10-05", party_name:"Client", party_gstin:"GST2", total_amount:1000000, sales_amount:1000000},
];
for (let index = 0; index < 30; index += 1) {
  vouchers.push({id:`low-${index}`, company_id:"a", voucher_number:`LOW-${index}`, voucher_type:"sales", voucher_date:"2026-10-06", party_name:"Client", party_gstin:"GST3", total_amount:1000, sales_amount:1000});
}
vouchers.push({id:"outlier", company_id:"a", voucher_number:"OUTLIER-2", voucher_type:"sales", voucher_date:"2026-10-07", party_name:"Client", party_gstin:"GST4", total_amount:10000000, sales_amount:10000000});
const result = calculate(vouchers);
if (result.workingCapital <= 0) throw new Error("working capital mismatch");
if (!result.duplicateVoucherNumbers.includes("DUP")) throw new Error("duplicate not detected");
if (!result.flags.some((flag) => flag.code === "HIGH_VALUE_B2B_MISSING_PARTY")) throw new Error("B2B flag missing");
if (result.amountOutliers < 1) throw new Error("statistical outlier missing");
console.log(JSON.stringify({workingCapital: result.workingCapital, duplicates: result.duplicateVoucherNumbers.length, flags: result.flags.length}));
"""
        completed = subprocess.run(
            ["node", "-e", script],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("workingCapital", completed.stdout)
    def test_test_marker_matches_e2e_and_legacy_ids(self) -> None:
        self.assertTrue(contains_test_marker("__FINORA_E2E_TEST__ Corp"))
        self.assertTrue(contains_test_marker("TEST_BATCH_001"))
        self.assertTrue(contains_test_marker("Purchase TEST 001"))

    def test_test_marker_does_not_match_contest_word(self) -> None:
        self.assertFalse(contains_test_marker("Contest Supplies"))


if __name__ == "__main__":
    unittest.main()
