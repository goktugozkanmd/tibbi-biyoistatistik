(function (root) {
  "use strict";

  // Inverse standard normal CDF (Acklam's rational approximation, max error < 1.15e-9)
  function normInv(p) {
    if (p <= 0 || p >= 1) {
      throw new Error("Olasılık 0 ile 1 arasında olmalıdır.");
    }
    const a = [
      -3.969683028665376e1, 2.209460984245205e2,
      -2.759285104469687e2, 1.383577518672690e2,
      -3.066479806614716e1, 2.506628277459239e0
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2,
      -1.556989798598866e2, 6.680131188771972e1,
      -1.328068155288572e1
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1,
      -2.400758277161838e0, -2.549732539343734e0,
      4.374664141464968e0, 2.938163982698783e0
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1,
      2.445134137142996e0, 3.754408661907416e0
    ];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  function fmtTR(num, decimals) {
    const d = decimals === undefined ? 2 : decimals;
    return Number(num).toFixed(d).replace(".", ",");
  }

  // 1A. İki bağımsız grup ortalama (Cohen's d, t-test yakınsaması + küçük örneklem serbestlik derecesi düzeltmesi)
  function sampleSizeTwoMeans(opts) {
    const alpha = Number(opts.alpha || 0.05);
    const power = Number(opts.power || 0.80);
    const tails = Number(opts.tails || 2);
    const ratio = Number(opts.ratio || 1);
    const nonParametric = Boolean(opts.nonParametric);

    let d = Number(opts.cohenD || 0);
    if (!d && opts.mean1 !== undefined && opts.mean2 !== undefined && opts.sd1 > 0) {
      const s1 = Number(opts.sd1);
      const s2 = Number(opts.sd2 || opts.sd1);
      const pooled = Math.sqrt((s1 * s1 + s2 * s2) / 2);
      d = Math.abs(Number(opts.mean1) - Number(opts.mean2)) / pooled;
    }
    if (!(d > 0)) {
      throw new Error("Etki büyüklüğü (Cohen's d) sıfırdan büyük olmalıdır.");
    }

    const zAlpha = normInv(1 - alpha / tails);
    const zBeta = normInv(power);
    // Normal approximation + Guenther (1981) t-distribution correction
    const n1Raw = ((1 + 1 / ratio) * Math.pow(zAlpha + zBeta, 2)) / (d * d);
    const dfCorrection = (zAlpha * zAlpha) / (2 * (1 + ratio));
    let n1 = Math.ceil(n1Raw + dfCorrection);
    let n2 = Math.ceil(n1 * ratio);

    if (nonParametric) {
      // Lehmann ARE adjustment for Mann-Whitney U (pi/3 ≈ 1.047 to 1.155 conservative 15%)
      n1 = Math.ceil(n1 * 1.15);
      n2 = Math.ceil(n2 * 1.15);
    }

    const total = n1 + n2;
    const withDropout = Math.ceil(total / 0.9);
    const powerPct = Math.round(power * 100);
    const testName = nonParametric ? "Mann-Whitney U testi (asimptotik göreli etkinlik düzeltmeli)" : "bağımsız örneklem t-testi";

    const ethicsTR =
      "Araştırmanın örneklem büyüklüğü Cohen (1988) etki büyüklüğü ölçütleri esas alınarak hesaplanmıştır. " +
      "İki bağımsız grup karşılaştırmasında (" + testName + ") d = " + fmtTR(d, 2) + " etki büyüklüğü, " +
      "α = " + fmtTR(alpha, 2) + " tip I hata düzeyi (" + (tails === 2 ? "çift yönlü" : "tek yönlü") + ") ve " +
      "%" + powerPct + " istatistiksel güç (1-β = " + fmtTR(power, 2) + ") hedeflendiğinde, " +
      "birinci grupta en az n₁ = " + n1 + " ve ikinci grupta en az n₂ = " + n2 + " olmak üzere toplam en az N = " + total + " olguya ulaşılması gerektiği saptanmıştır. " +
      "Olası %10 veri kaybı/eksik veri payı dikkate alındığında çalışmaya toplam " + withDropout + " olgunun dahil edilmesi planlanmıştır.";

    const ethicsEN =
      "A priori sample size calculation was performed based on Cohen's (1988) methodology for two independent groups. " +
      "Assuming an effect size of d = " + Number(d).toFixed(2) + ", a " + (tails === 2 ? "two-sided" : "one-sided") +
      " type I error rate of α = " + Number(alpha).toFixed(2) + ", and " + powerPct + "% statistical power (1-β = " + Number(power).toFixed(2) + "), " +
      "a minimum of " + n1 + " participants in Group 1 and " + n2 + " participants in Group 2 (total N = " + total + ") were required. " +
      "Accounting for a potential 10% attrition/missing data rate, the target sample size was set at " + withDropout + ".";

    return { n1, n2, total, withDropout, effectMetric: "Cohen's d = " + fmtTR(d, 2), ethicsTR, ethicsEN };
  }

  // 1B. İki bağımsız oran (Fleiss 1981 süreklilik düzeltmeli / düzeltmesiz)
  function sampleSizeTwoProportions(opts) {
    const p1 = Number(opts.p1);
    const p2 = Number(opts.p2);
    const alpha = Number(opts.alpha || 0.05);
    const power = Number(opts.power || 0.80);
    const ratio = Number(opts.ratio || 1);
    const continuity = opts.continuity !== false;

    if (!(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1) || Math.abs(p1 - p2) < 1e-6) {
      throw new Error("Grup oranları 0 ile 1 arasında ve birbirinden farklı olmalıdır.");
    }

    const zAlpha = normInv(1 - alpha / 2);
    const zBeta = normInv(power);
    const pBar = (p1 + ratio * p2) / (1 + ratio);
    const qBar = 1 - pBar;
    const diff = Math.abs(p1 - p2);

    const term1 = zAlpha * Math.sqrt((1 + 1 / ratio) * pBar * qBar);
    const term2 = zBeta * Math.sqrt(p1 * (1 - p1) + (p2 * (1 - p2)) / ratio);
    const n1Uncorr = Math.pow(term1 + term2, 2) / (diff * diff);

    let n1 = Math.ceil(n1Uncorr);
    if (continuity) {
      n1 = Math.ceil((n1Uncorr / 4) * Math.pow(1 + Math.sqrt(1 + (2 * (1 + ratio)) / (ratio * n1Uncorr * diff)), 2));
    }
    const n2 = Math.ceil(n1 * ratio);
    const total = n1 + n2;
    const withDropout = Math.ceil(total / 0.9);
    const powerPct = Math.round(power * 100);

    const ethicsTR =
      "Araştırmanın örneklem büyüklüğü iki bağımsız oranın karşılaştırılması amacıyla Fleiss (1981) yöntemiyle hesaplanmıştır. " +
      "Literatür verileri doğrultusunda beklenen olay oranları birinci grupta %" + fmtTR(p1 * 100, 1) + " ve ikinci grupta %" + fmtTR(p2 * 100, 1) +
      " olarak alındığında, α = " + fmtTR(alpha, 2) + " çift yönlü yanılma payı ve %" + powerPct + " güç (1-β = " + fmtTR(power, 2) + ") düzeyinde " +
      "gruplarda sırasıyla en az n₁ = " + n1 + " ve n₂ = " + n2 + " olmak üzere toplam N = " + total + " olgu gerektiği belirlenmiştir (%10 kayıp payıyla N = " + withDropout + ").";

    const ethicsEN =
      "Sample size was estimated for comparing two independent proportions (Fleiss, 1981). Assuming event rates of " +
      (p1 * 100).toFixed(1) + "% vs. " + (p2 * 100).toFixed(1) + "%, a two-sided α = " + alpha.toFixed(2) + ", and " + powerPct +
      "% power, at least n₁ = " + n1 + " and n₂ = " + n2 + " subjects (total N = " + total + "; " + withDropout + " allowing 10% dropout) were required.";

    return { n1, n2, total, withDropout, effectMetric: "Δp = %" + fmtTR(diff * 100, 1), ethicsTR, ethicsEN };
  }

  // 1C. Tek grup prevalans / kesitsel araştırma
  function sampleSizePrevalence(opts) {
    const p = Number(opts.prevalence || 0.20);
    const d = Number(opts.margin || 0.05);
    const alpha = Number(opts.alpha || 0.05);
    const popSize = Number(opts.population || 0);

    if (!(p > 0 && p < 1) || !(d > 0 && d < 0.5)) {
      throw new Error("Prevalans (0-1) ve hata payı (0-0,50) geçerli aralıkta olmalıdır.");
    }
    const z = normInv(1 - alpha / 2);
    let n0 = (z * z * p * (1 - p)) / (d * d);
    let n = popSize > 0 ? Math.ceil((n0 * popSize) / (n0 + popSize - 1)) : Math.ceil(n0);
    const withDropout = Math.ceil(n / 0.9);

    const ethicsTR =
      "Kesitsel tipteki bu araştırmanın örneklem büyüklüğü bilinen/tahmini prevalans formülü [n = Z²·p·(1-p)/d²] ile hesaplanmıştır. " +
      "İncelenen durumun beklenen sıklığı %" + fmtTR(p * 100, 1) + ", kabul edilebilir hata payı d = ±%" + fmtTR(d * 100, 1) +
      " ve güven düzeyi %" + Math.round((1 - alpha) * 100) + " (α = " + fmtTR(alpha, 2) + ")" +
      (popSize > 0 ? " ve sonlu evren büyüklüğü N = " + popSize : "") +
      " alındığında ulaşılması gereken asgari örneklem büyüklüğü N = " + n + " (%10 yedek payıyla " + withDropout + ") olarak bulunmuştur.";

    const ethicsEN =
      "Sample size for this cross-sectional study was calculated using the single-proportion precision formula with expected prevalence p = " +
      (p * 100).toFixed(1) + "%, margin of error d = ±" + (d * 100).toFixed(1) + "%, and α = " + alpha.toFixed(2) +
      (popSize > 0 ? " (finite population N = " + popSize + ")" : "") + ", yielding a minimum required N = " + n + " (" + withDropout + " with 10% reserve).";

    return { n1: n, n2: 0, total: n, withDropout, effectMetric: "p = %" + fmtTR(p * 100, 1) + " ± %" + fmtTR(d * 100, 1), ethicsTR, ethicsEN };
  }

  // 1D. ROC Eğrisi (AUC) örneklem büyüklüğü (Hanley & McNeil 1982)
  function sampleSizeRocAuc(opts) {
    const auc = Number(opts.auc || 0.75);
    const auc0 = Number(opts.nullAuc || 0.50);
    const alpha = Number(opts.alpha || 0.05);
    const power = Number(opts.power || 0.80);
    const ratio = Number(opts.ratio || 1); // kontrol / hasta oranı

    if (!(auc > auc0 && auc < 1)) {
      throw new Error("Beklenen AUROC değeri 0,50 ile 1,00 arasında olmalıdır.");
    }
    const zAlpha = normInv(1 - alpha / 2);
    const zBeta = normInv(power);

    const q1 = auc / (2 - auc);
    const q2 = (2 * auc * auc) / (1 + auc);
    const varNull = (0.25 + (ratio > 0 ? (1 / ratio) * 0.25 : 0.25)); // AUC0=0.50: Q1=1/3, Q2=1/3 -> A(1-A)=0.25, Q1-A^2=1/12, Q2-A^2=1/12
    // Exact Obuchowski / Hanley-McNeil variance under H0 (auc0) and H1 (auc)
    const q1_0 = auc0 / (2 - auc0);
    const q2_0 = (2 * auc0 * auc0) / (1 + auc0);
    const v0 = auc0 * (1 - auc0) + (q1_0 - auc0 * auc0) * 0 + (q2_0 - auc0 * auc0) / ratio;
    const v1 = auc * (1 - auc) + (q2 - auc * auc) / ratio;
    // Iterative exact solve because (nD - 1) and (nN - 1) appear in Hanley-McNeil SE
    let nDisease = Math.ceil(Math.pow(zAlpha * Math.sqrt(v0) + zBeta * Math.sqrt(v1), 2) / Math.pow(auc - auc0, 2));
    for (let iter = 0; iter < 12; iter++) {
      const nHealthy = Math.max(2, nDisease * ratio);
      const se0Sq = (auc0 * (1 - auc0) + (nDisease - 1) * (q1_0 - auc0 * auc0) + (nHealthy - 1) * (q2_0 - auc0 * auc0)) / (nDisease * nHealthy);
      const se1Sq = (auc * (1 - auc) + (nDisease - 1) * (q1 - auc * auc) + (nHealthy - 1) * (q2 - auc * auc)) / (nDisease * nHealthy);
      const zAchieved = (auc - auc0 - zAlpha * Math.sqrt(se0Sq)) / Math.sqrt(se1Sq);
      if (zAchieved >= zBeta) break;
      nDisease += 1;
    }
    const nControl = Math.ceil(nDisease * ratio);
    const total = nDisease + nControl;
    const withDropout = Math.ceil(total / 0.9);
    const powerPct = Math.round(power * 100);

    const ethicsTR =
      "Biyobelirtecin/ölçeğin tanısal ayırt ediciliğini değerlendirmek amacıyla ROC eğrisi altında kalan alan (AUROC) için Hanley ve McNeil (1982) yöntemiyle örneklem büyüklüğü hesaplanmıştır. " +
      "Sıfır hipotezi AUROC₀ = " + fmtTR(auc0, 2) + " değerine karşı beklenen tanısal performans AUROC₁ = " + fmtTR(auc, 2) +
      ", α = " + fmtTR(alpha, 2) + " tip I hata ve %" + powerPct + " güç (1-β = " + fmtTR(power, 2) + ") alındığında, " +
      "hasta grubunda en az n₁ = " + nDisease + " ve kontrol grubunda en az n₂ = " + nControl + " olmak üzere toplam en az N = " + total + " olgu gerektiği saptanmıştır (%10 kayıp payıyla N = " + withDropout + ").";

    const ethicsEN =
      "Sample size for receiver operating characteristic (ROC) curve analysis was determined using the method of Hanley and McNeil (1982). " +
      "To detect an expected AUROC of " + auc.toFixed(2) + " against the null value of " + auc0.toFixed(2) + " with two-sided α = " + alpha.toFixed(2) +
      " and " + powerPct + "% power, at least " + nDisease + " cases and " + nControl + " controls (total N = " + total + ") were required.";

    return { n1: nDisease, n2: nControl, total, withDropout, effectMetric: "AUROC = " + fmtTR(auc, 2), ethicsTR, ethicsEN };
  }

  // 2. Wilson %95 Güven Aralığı + 2x2 Tanısal Doğruluk
  function wilsonCI(k, n, alpha) {
    if (n <= 0) return [0, 0];
    const z = normInv(1 - (alpha || 0.05) / 2);
    const p = k / n;
    const denom = 1 + (z * z) / n;
    const center = (p + (z * z) / (2 * n)) / denom;
    const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
    return [Math.max(0, center - half), Math.min(1, center + half)];
  }

  function calcDiagnostic2x2(tp, fp, fn, tn) {
    tp = Number(tp); fp = Number(fp); fn = Number(fn); tn = Number(tn);
    const diseased = tp + fn;
    const healthy = fp + tn;
    const pos = tp + fp;
    const neg = fn + tn;
    const total = diseased + healthy;
    if (diseased <= 0 || healthy <= 0) {
      throw new Error("Hasta (GP+YN) ve Sağlıklı (YP+GN) toplamları sıfırdan büyük olmalıdır.");
    }

    const sens = tp / diseased;
    const spec = tn / healthy;
    const ppv = pos > 0 ? tp / pos : 0;
    const npv = neg > 0 ? tn / neg : 0;
    const acc = (tp + tn) / total;
    const youden = sens + spec - 1;

    // Haldane-Anscombe 0.5 continuity if zero cell for LR
    const tpC = tp === 0 || fp === 0 || fn === 0 || tn === 0 ? tp + 0.5 : tp;
    const fpC = tp === 0 || fp === 0 || fn === 0 || tn === 0 ? fp + 0.5 : fp;
    const fnC = tp === 0 || fp === 0 || fn === 0 || tn === 0 ? fn + 0.5 : fn;
    const tnC = tp === 0 || fp === 0 || fn === 0 || tn === 0 ? tn + 0.5 : tn;
    const sC = tpC / (tpC + fnC);
    const spC = tnC / (fpC + tnC);
    const lrPos = sC / (1 - spC);
    const lrNeg = (1 - sC) / spC;

    return {
      sens: { val: sens, ci: wilsonCI(tp, diseased) },
      spec: { val: spec, ci: wilsonCI(tn, healthy) },
      ppv: { val: ppv, ci: wilsonCI(tp, pos) },
      npv: { val: npv, ci: wilsonCI(tn, neg) },
      acc: { val: acc, ci: wilsonCI(tp + tn, total) },
      youden,
      lrPos,
      lrNeg
    };
  }

  // 3. Biyoistatistik Test Seçici Karar Motoru
  function recommendStatTest(q) {
    const { goal, groups, paired, dist, covariates } = q;
    if (goal === "survival") {
      return {
        primary: covariates === "yes" ? "Cox Orantılı Tehlikeler Regresyonu (HR, %95 GA)" : "Kaplan-Meier Sağkalım Analizi + Log-Rank Testi",
        effect: "Hazard Ratio (HR) ve %95 Güven Aralığı",
        note: "SCIE dergilerde orantılı tehlikeler varsayımı Schoenfeld artıkları (Schoenfeld residuals) ile doğrulanmalıdır."
      };
    }
    if (goal === "diagnostic") {
      return {
        primary: "ROC Eğrisi Analizi (AUROC) + Youden İndeksi + DeLong İkili ROC Karşılaştırması",
        effect: "AUROC (%95 GA), Duyarlılık, Özgüllük, PPV, NPV, LR+",
        note: "İki biyobelirtecin AUROC farkı rastgele p değeriyle değil DeLong (1988) testiyle karşılaştırılmalıdır."
      };
    }
    if (goal === "binary_outcome") {
      if (covariates === "yes") {
        return {
          primary: "Çok Değişkenli Lojistik Regresyon veya Modifiye Poisson Regresyonu (Robust SE)",
          effect: "Düzeltilmiş Odds Oranı (aOR) veya Prevalans Oranı (aPR, %95 GA)",
          note: "Kesitsel çalışmalarda sonuç sıklığı >%10 ise Odds Ratio riski abartır; hakemler Zou (2004) Modifiye Poisson aPR modelini tercih eder."
        };
      }
      if (paired === "yes") {
        return {
          primary: groups === "2" ? "McNemar Testi" : "Cochran Q Testi",
          effect: "Eşleştirilmiş Oran Farkı (%95 GA)",
          note: "Tedavi öncesi-sonrası ikili (var/yok) değişimlerde bağımsız Ki-Kare kullanılması en sık tez/hakem ret nedenidir."
        };
      }
      return {
        primary: "Pearson Ki-Kare Testi (beklenen göz <5 ise Fisher Exact Test)",
        effect: "Cramér's V / Risk Oranı (RR) / Odds Oranı (OR, %95 GA)",
        note: "2×2 tablolarda herhangi bir hücrede beklenen frekans 5'in altındaysa mutlaka Fisher's Exact raporlanmalıdır."
      };
    }
    // Continuous outcome
    if (covariates === "yes") {
      return {
        primary: paired === "yes" ? "Doğrusal Karma Etkiler Modeli (Linear Mixed-Effects Model / GEE)" : "Çoklu Doğrusal Regresyon veya ANCOVA",
        effect: "Düzeltilmiş Regresyon Katsayısı (β, %95 GA) ve R²",
        note: "Çoklu bağlantı (VIF < 5) ve artıkların normalliği kontrol edilerek tablo halinde sunulmalıdır."
      };
    }
    if (groups === "2") {
      if (paired === "yes") {
        return dist === "normal"
          ? { primary: "Eşleştirilmiş Örneklem t-Testi (Paired Samples t-Test)", effect: "Cohen's dz ve Ortalama Fark (%95 GA)", note: "Fark puanlarının (önce - sonra) Shapiro-Wilk ile normal dağıldığı teyit edilmelidir." }
          : { primary: "Wilcoxon İşaretli Sıralar Testi (Wilcoxon Signed-Rank)", effect: "Medyan (IQR: 25.–75. persentil) ve Rank-Biserial Korelasyon (r)", note: "Normal dağılmayan verilerde ortalama±SS yerine mutlaka Medyan (Çeyrekler Arası Aralık) yazılmalıdır." };
      }
      return dist === "normal"
        ? { primary: "Bağımsız Örneklem t-Testi (Varyans homojen değilse Welch t-Testi)", effect: "Cohen's d / Hedges' g ve Ortalama Fark (%95 GA)", note: "Levene varyans homojenliği bozulduğunda Welch düzeltmeli t-testi raporlanmalıdır." }
        : { primary: "Mann-Whitney U Testi", effect: "Medyan (IQR) ve Rank-Biserial r Etki Büyüklüğü", note: "Yalnızca p değeri yetmez; güncel dergiler etki büyüklüğü (r) ve %95 güven aralığını zorunlu tutmaktadır." };
    }
    // 3+ groups
    if (paired === "yes") {
      return dist === "normal"
        ? { primary: "Tekrarlı Ölçümler ANOVA (Küresellik bozulursa Greenhouse-Geisser düzeltmeli)", effect: "Kısmi Eta-Kare (ηp²)", note: "Mauchly küresellik testi p < 0,05 ise serbestlik derecesine Greenhouse-Geisser düzeltmesi uygulanır." }
        : { primary: "Friedman Testi + Bonferroni Düzeltmeli İkili Wilcoxon Post-Hoc", effect: "Kendall's W Uyum Katsayısı", note: "3 veya daha fazla zaman noktasında hangi zaman dilimlerinin farklı olduğu post-hoc ile gösterilmelidir." };
    }
    return dist === "normal"
      ? { primary: "Tek Yönlü ANOVA + Tukey HSD (Varyans eşit değilse Welch ANOVA + Games-Howell)", effect: "Eta-Kare (η²) / Omega-Kare (ω²)", note: "Varyanslar homojen değilken standart ANOVA ve Tukey kullanılması hakem revizyonlarında sıkça eleştirilir." }
      : { primary: "Kruskal-Wallis H Testi + Dunn-Bonferroni Post-Hoc Karşılaştırması", effect: "Epsilon-Kare (ε²)", note: "Farkın hangi alt gruplar arasında çıktığı Dunn testi düzeltilmiş p değerleriyle harflendirilerek tabloya eklenmelidir." };
  }

  const api = {
    normInv,
    fmtTR,
    sampleSizeTwoMeans,
    sampleSizeTwoProportions,
    sampleSizePrevalence,
    sampleSizeRocAuc,
    wilsonCI,
    calcDiagnostic2x2,
    recommendStatTest
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BiostatEngine = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
