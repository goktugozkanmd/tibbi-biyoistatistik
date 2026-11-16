(function () {
  "use strict";

  const E = window.BiostatEngine;
  if (!E) return;

  // Main Tool Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tool-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add("active");
    });
  });

  // Sample Size Design Switcher
  const designSelect = document.getElementById("ssDesign");
  function syncDesignInputs() {
    if (!designSelect) return;
    const val = designSelect.value;
    document.querySelectorAll(".ss-subform").forEach((el) => {
      el.classList.toggle("hidden", el.dataset.design !== val);
    });
  }

  function runSampleSize() {
    if (!designSelect) return;
    const design = designSelect.value;
    const alpha = parseFloat(document.getElementById("ssAlpha").value) || 0.05;
    const power = parseFloat(document.getElementById("ssPower").value) || 0.80;

    try {
      let res;
      if (design === "means") {
        res = E.sampleSizeTwoMeans({
          cohenD: parseFloat(document.getElementById("ssCohenD").value) || 0.5,
          alpha,
          power,
          ratio: parseFloat(document.getElementById("ssRatio").value) || 1,
          nonParametric: document.getElementById("ssNonParam").value === "yes"
        });
      } else if (design === "props") {
        res = E.sampleSizeTwoProportions({
          p1: (parseFloat(document.getElementById("ssP1").value) || 15) / 100,
          p2: (parseFloat(document.getElementById("ssP2").value) || 35) / 100,
          alpha,
          power,
          ratio: parseFloat(document.getElementById("ssPropRatio").value) || 1,
          continuity: true
        });
      } else if (design === "prev") {
        res = E.sampleSizePrevalence({
          prevalence: (parseFloat(document.getElementById("ssPrev").value) || 20) / 100,
          margin: (parseFloat(document.getElementById("ssMargin").value) || 5) / 100,
          alpha,
          population: parseInt(document.getElementById("ssPop").value || "0", 10)
        });
      } else {
        res = E.sampleSizeRocAuc({
          auc: parseFloat(document.getElementById("ssAuc").value) || 0.75,
          nullAuc: 0.50,
          alpha,
          power,
          ratio: parseFloat(document.getElementById("ssRocRatio").value) || 1
        });
      }

      document.getElementById("outN1").textContent = res.n2 > 0 ? res.n1 + " + " + res.n2 : String(res.n1);
      document.getElementById("outTotal").textContent = String(res.total);
      document.getElementById("outDropout").textContent = String(res.withDropout);
      document.getElementById("outEthicsTR").textContent = res.ethicsTR;
      document.getElementById("outEthicsEN").textContent = res.ethicsEN;
    } catch (err) {
      document.getElementById("outEthicsTR").textContent = "Uyarı: " + err.message;
    }
  }

  if (designSelect) {
    designSelect.addEventListener("change", () => {
      syncDesignInputs();
      runSampleSize();
    });
    document.getElementById("btnCalcSS").addEventListener("click", runSampleSize);
    syncDesignInputs();
    runSampleSize();
  }

  // Test Selector
  const btnSelectTest = document.getElementById("btnSelectTest");
  function runTestSelector() {
    if (!btnSelectTest) return;
    const out = E.recommendStatTest({
      goal: document.getElementById("tsGoal").value,
      groups: document.getElementById("tsGroups").value,
      paired: document.getElementById("tsPaired").value,
      dist: document.getElementById("tsDist").value,
      covariates: document.getElementById("tsCov").value
    });
    document.getElementById("tsPrimary").textContent = out.primary;
    document.getElementById("tsEffect").textContent = out.effect;
    document.getElementById("tsNote").textContent = out.note;
  }
  if (btnSelectTest) {
    btnSelectTest.addEventListener("click", runTestSelector);
    ["tsGoal", "tsGroups", "tsPaired", "tsDist", "tsCov"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", runTestSelector);
    });
    runTestSelector();
  }

  // Diagnostic 2x2 Calculator
  const btnDiag = document.getElementById("btnCalcDiag");
  function fmtPctCI(obj) {
    const v = E.fmtTR(obj.val * 100, 1) + "%";
    const lo = E.fmtTR(obj.ci[0] * 100, 1);
    const hi = E.fmtTR(obj.ci[1] * 100, 1);
    return v + " (" + lo + "–" + hi + ")";
  }
  function runDiag() {
    if (!btnDiag) return;
    try {
      const d = E.calcDiagnostic2x2(
        document.getElementById("dTP").value,
        document.getElementById("dFP").value,
        document.getElementById("dFN").value,
        document.getElementById("dTN").value
      );
      document.getElementById("diagSens").textContent = fmtPctCI(d.sens);
      document.getElementById("diagSpec").textContent = fmtPctCI(d.spec);
      document.getElementById("diagPPV").textContent = fmtPctCI(d.ppv);
      document.getElementById("diagNPV").textContent = fmtPctCI(d.npv);
      document.getElementById("diagAcc").textContent = fmtPctCI(d.acc);
      document.getElementById("diagLR").textContent =
        "LR+: " + E.fmtTR(d.lrPos, 2) + "  |  LR−: " + E.fmtTR(d.lrNeg, 2) + "  |  Youden J: " + E.fmtTR(d.youden, 2);
    } catch (err) {
      document.getElementById("diagLR").textContent = err.message;
    }
  }
  if (btnDiag) {
    btnDiag.addEventListener("click", runDiag);
    runDiag();
  }

  // Copy helpers
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      await navigator.clipboard.writeText(target.textContent.trim());
      const orig = btn.textContent;
      btn.textContent = "Kopyalandı";
      setTimeout(() => { btn.textContent = orig; }, 1600);
    });
  });

  // Consultation Pre-filled Email Builder
  const intakeForm = document.getElementById("intakeForm");
  if (intakeForm) {
    intakeForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const workType = document.getElementById("inType").value;
      const sampleN = document.getElementById("inSample").value.trim();
      const deadline = document.getElementById("inDeadline").value.trim();
      const notes = document.getElementById("inNotes").value.trim();

      const subj = "[Biyoistatistik Ön İnceleme] " + workType;
      const body = [
        "Merhaba Dr. Göktuğ Bey,",
        "",
        "Çalışma Türü: " + workType,
        "Örneklem / Veri Durumu: " + (sampleN || "Belirtilmedi"),
        "Hedef Teslim Tarihi: " + (deadline || "Belirtilmedi"),
        "Kısa Açıklama / Hipotez: " + (notes || "-"),
        "",
        "Veri yapısına uygun analiz paketi ve teslim süresi hakkında bilgi rica ederim."
      ].join("\n");

      const statusEl = document.getElementById("intakeStatus");
      statusEl.classList.remove("hidden");
      statusEl.innerHTML =
        "E-posta taslağınız açılıyor. Açılmazsa doğrudan <strong>drozkan2@gmail.com</strong> adresine veri özetinizi gönderebilirsiniz (metin panoya kopyalandı).";
      if (navigator.clipboard) {
        navigator.clipboard.writeText("Alıcı: drozkan2@gmail.com\nKonu: " + subj + "\n\n" + body).catch(() => {});
      }
      window.location.href =
        "mailto:drozkan2@gmail.com?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
    });
  }
})();
