import re
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\janit\Desktop\G\tibbi-biyoistatistik")


def test_zero_phone_number_and_required_contact():
    phone_re = re.compile(r"0\s*538|538\s*597|\+90\s*5")
    for p in ROOT.rglob("*"):
        if p.is_file() and p.suffix in {".html", ".js", ".css", ".xml", ".txt", ".md"}:
            txt = p.read_text(encoding="utf-8")
            assert not phone_re.search(txt), f"Forbidden phone number pattern in {p}"
    idx = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "drozkan2@gmail.com" in idx
    assert "Tibbi-makale-tez-ve-klinik-veri-biyoistatistik-analizi-yaparim-894502" in idx


def test_js_syntax():
    for f in ("biostat_engine.js", "app.js"):
        r = subprocess.run(["node", "--check", str(ROOT / f)], capture_output=True, text=True, timeout=5)
        assert r.returncode == 0, r.stderr


def test_biostat_math_matches_gpower_and_wilson():
    script = r"""
const E = require('./biostat_engine.js');
const assert = require('assert');

// G*Power 3.1.9.7 exact benchmark: two-tailed t-test d=0.50, alpha=0.05, power=0.80 -> n1=64, n2=64, total=128
const m = E.sampleSizeTwoMeans({ cohenD: 0.5, alpha: 0.05, power: 0.8, tails: 2, ratio: 1, nonParametric: false });
assert.strictEqual(m.n1, 64);
assert.strictEqual(m.n2, 64);
assert.strictEqual(m.total, 128);
assert(m.ethicsTR.includes('128'));

// Fleiss two proportions 15% vs 35%, alpha=0.05, power=0.80 (continuity corrected ~82 per group)
const pr = E.sampleSizeTwoProportions({ p1: 0.15, p2: 0.35, alpha: 0.05, power: 0.80, ratio: 1, continuity: true });
assert(pr.n1 >= 80 && pr.n1 <= 84, 'Unexpected Fleiss n1=' + pr.n1);

// Prevalence p=0.50, d=0.05, alpha=0.05 -> 385
const pv = E.sampleSizePrevalence({ prevalence: 0.50, margin: 0.05, alpha: 0.05 });
assert.strictEqual(pv.total, 385);

// Hanley-McNeil ROC AUC=0.75 vs 0.50, alpha=0.05, power=0.80 -> ~33-38 per group
const roc = E.sampleSizeRocAuc({ auc: 0.75, nullAuc: 0.50, alpha: 0.05, power: 0.80, ratio: 1 });
assert(roc.n1 >= 30 && roc.n1 <= 42, 'Unexpected ROC n1=' + roc.n1);

// 2x2 Diagnostic accuracy: TP=80, FP=20, FN=20, TN=80 -> Sens=0.80, Spec=0.80, LR+=4.0
const dg = E.calcDiagnostic2x2(80, 20, 20, 80);
assert(Math.abs(dg.sens.val - 0.80) < 1e-9);
assert(Math.abs(dg.lrPos - 4.0) < 1e-9);
assert(dg.sens.ci[0] > 0.70 && dg.sens.ci[1] < 0.87);

// Test selector: cross-sectional binary with covariates -> Modified Poisson aPR note
const ts = E.recommendStatTest({ goal: 'binary_outcome', groups: '2', paired: 'no', dist: 'nonnormal', covariates: 'yes' });
assert(ts.primary.includes('Modifiye Poisson'));

console.log('BIOSTAT_MATH_OK');
"""
    r = subprocess.run(["node", "-e", script], cwd=str(ROOT), capture_output=True, text=True, timeout=5)
    assert r.returncode == 0, r.stderr
    assert "BIOSTAT_MATH_OK" in r.stdout
