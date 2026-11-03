/* 계산 로직(Calc)과 화면 연결 도우미(UI). 각 도구 페이지의 인라인 스크립트가 이 둘을 사용한다. */
(function (global) {
  'use strict';

  const DAY = 86400000;
  const PYEONG = 400 / 121; // 1평 = 3.305785...㎡

  // ---------- 날짜 ----------
  function toUTC(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / DAY); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  // 말일 보정: 1월 31일 + 1개월 = 2월 28(29)일
  function addMonths(d, n) {
    const y = d.getFullYear(), m = d.getMonth() + n;
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d.getDate(), last));
  }
  function fullYears(from, to) {
    let y = to.getFullYear() - from.getFullYear();
    if (to.getMonth() < from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) y--;
    return y;
  }
  function fullMonths(from, to) {
    let m = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    if (to.getDate() < from.getDate()) m--;
    return m;
  }
  function fmtDate(d) {
    const w = '일월화수목금토'[d.getDay()];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
  }

  // ---------- 직장·급여 ----------
  // end는 퇴사일(마지막 근무일의 다음 날)
  function severance(o) {
    const days = daysBetween(o.start, o.end);
    const days3m = daysBetween(addMonths(o.end, -3), o.end);
    const total3m = o.wage3m + (o.bonusYear || 0) * 3 / 12 + (o.leavePay || 0) * 3 / 12;
    const avgDaily = total3m / days3m;
    return { days, eligible: days >= 365, days3m, total3m, avgDaily, amount: avgDaily * 30 * days / 365 };
  }

  function annualLeave(start, ref) {
    const years = fullYears(start, ref);
    if (years < 1) {
      const months = Math.min(11, Math.max(0, fullMonths(start, ref)));
      return { years: 0, months, days: months, firstYear: true };
    }
    return { years, days: Math.min(25, 15 + Math.floor((years - 1) / 2)), firstYear: false };
  }

  // 주 15시간 이상이면 (주 소정근로시간 / 40) × 8시간, 40시간 초과분은 반영하지 않음
  function weeklyHolidayHours(h) { return h >= 15 ? Math.min(h, 40) / 40 * 8 : 0; }
  function monthlyHours(h) { return Math.round((h + weeklyHolidayHours(h)) * 365 / 7 / 12); }

  // 구직급여: 2026-01-01 이후 이직자 기준 (고용보험법 시행령 제68조, 고용노동부 FAQ)
  const UI_RULES = {
    dailyCap: 68100,          // 1일 상한 (기초일액 상한 113,500원 × 60%)
    minWage: 10320,           // 2026년 최저시급
    days: {                   // 소정급여일수 [1년 미만, 1~3년, 3~5년, 5~10년, 10년 이상]
      under50: [120, 150, 180, 210, 240],
      over50: [120, 180, 210, 240, 270],
    },
  };
  // insured: 0~4 (가입기간 구간 인덱스), end: 이직일 다음 날(퇴사일)
  function unemployment(o) {
    const days3m = daysBetween(addMonths(o.end, -3), o.end);
    const avgDaily = o.wage3m / days3m;
    const hours = Math.min(8, Math.max(1, o.dailyHours || 8));
    const floor = UI_RULES.minWage * 0.8 * hours;
    const raw = avgDaily * 0.6;
    const daily = Math.max(floor, Math.min(raw, UI_RULES.dailyCap));
    const payDays = UI_RULES.days[o.over50 ? 'over50' : 'under50'][o.insured];
    return { days3m, avgDaily, raw, floor, cap: UI_RULES.dailyCap, daily, payDays, total: daily * payDays,
      capped: raw > UI_RULES.dailyCap, floored: raw < floor };
  }

  // 육아휴직 급여 (고용보험법 시행령 제95조, 제95조의3, 2025-01-01 시행 기준)
  function parentalLeave(monthlyWage, months, sixPlusSix) {
    const SIX = [2500000, 2500000, 3000000, 3500000, 4000000, 4500000];
    const rows = [];
    let total = 0;
    for (let m = 1; m <= months; m++) {
      let rate, cap;
      if (sixPlusSix && m <= 6) { rate = 1; cap = SIX[m - 1]; }
      else if (m <= 3) { rate = 1; cap = 2500000; }
      else if (m <= 6) { rate = 1; cap = 2000000; }
      else { rate = 0.8; cap = 1600000; }
      const amount = Math.max(700000, Math.min(monthlyWage * rate, cap));
      rows.push({ m, rate, cap, amount });
      total += amount;
    }
    return { rows, total };
  }

  // 주택 중개보수 상한 (공인중개사법 시행규칙 제20조, 2021-10-19 개정)
  const BROKER = {
    sale: [[5e7, 0.006, 250000], [2e8, 0.005, 800000], [9e8, 0.004, 0], [12e8, 0.005, 0], [15e8, 0.006, 0], [Infinity, 0.007, 0]],
    lease: [[5e7, 0.005, 200000], [1e8, 0.004, 300000], [6e8, 0.003, 0], [12e8, 0.004, 0], [15e8, 0.005, 0], [Infinity, 0.006, 0]],
  };
  function brokerage(kind, price, deposit, monthly) {
    let amount = kind === 'sale' ? price : deposit + monthly * 100;
    let rentBase = null;
    if (kind === 'lease' && monthly > 0) {
      rentBase = 100;
      if (amount < 5e7) { amount = deposit + monthly * 70; rentBase = 70; }
    }
    const [, rate, limit] = BROKER[kind].find(([upper]) => amount < upper);
    const raw = amount * rate;
    const fee = limit ? Math.min(raw, limit) : raw;
    return { amount, rate, limit, fee, rentBase };
  }

  // 전월세 전환율 상한 (주택임대차보호법 시행령 제9조) = min(10%, 기준금리 + 2%p)
  const BASE_RATE = { value: 3.0, asOf: '2026-08-27' };
  function legalConversionRate(base) {
    return Math.min(10, (base == null ? BASE_RATE.value : base) + 2);
  }

  // 군 복무기간(개월), 병무청 기준
  const SERVICE = {
    army: ['육군', 18], marine: ['해병대', 18], navy: ['해군', 20], airforce: ['공군', 21],
    reserve: ['상근예비역', 18], social: ['사회복무요원', 21], alternative: ['대체복무요원', 36],
  };
  // 입영일부터 기산: 입영일 + N개월의 전날. 해당 날짜가 없는 달이면 그 달 말일 (민법 제160조)
  function discharge(entry, months) {
    const y = entry.getFullYear(), m = entry.getMonth() + months;
    const last = new Date(y, m + 1, 0).getDate();
    if (entry.getDate() > last) return new Date(y, m, last);
    return addDays(new Date(y, m, entry.getDate()), -1);
  }

  // ---------- 연말정산 (2026년 귀속, 근로소득만 있는 경우) ----------
  // 근거: 소득세법 제47조·제50조·제51조·제55조·제59조~제59조의4, 조세특례제한법 제92조·제95조의2·제126조의2
  // (law.go.kr 2026-11-02 기준 시행 법령. 2026 세제개편안은 2027년 귀속부터라 반영하지 않음)
  const MAN = 10000;
  function earnedIncomeDeduction(g) {
    let d;
    if (g <= 500 * MAN) d = g * 0.7;
    else if (g <= 1500 * MAN) d = 350 * MAN + (g - 500 * MAN) * 0.4;
    else if (g <= 4500 * MAN) d = 750 * MAN + (g - 1500 * MAN) * 0.15;
    else if (g <= 10000 * MAN) d = 1200 * MAN + (g - 4500 * MAN) * 0.05;
    else d = 1475 * MAN + (g - 10000 * MAN) * 0.02;
    return Math.min(d, 2000 * MAN);
  }
  // 기본세율 [상한, 세율, 누적세액]
  const TAX_BRACKETS = [[1400, 0.06, 0], [5000, 0.15, 84], [8800, 0.24, 624], [15000, 0.35, 1536],
    [30000, 0.38, 3706], [50000, 0.40, 9406], [100000, 0.42, 17406], [Infinity, 0.45, 38406]];
  function incomeTax(base) {
    if (base <= 0) return 0;
    let lower = 0;
    for (const [upper, rate, acc] of TAX_BRACKETS) {
      if (base <= upper * MAN) return acc * MAN + (base - lower * MAN) * rate;
      lower = upper;
    }
  }
  function earnedTaxCredit(tax, g) {
    const raw = tax <= 130 * MAN ? tax * 0.55 : 71.5 * MAN + (tax - 130 * MAN) * 0.3;
    let cap;
    if (g <= 3300 * MAN) cap = 74 * MAN;
    else if (g <= 7000 * MAN) cap = Math.max(66 * MAN, 74 * MAN - (g - 3300 * MAN) * 0.008);
    else if (g <= 12000 * MAN) cap = Math.max(50 * MAN, 66 * MAN - (g - 7000 * MAN) / 2);
    else cap = Math.max(20 * MAN, 50 * MAN - (g - 12000 * MAN) / 2);
    return Math.min(raw, cap);
  }
  // 자녀세액공제: kids = 기본공제 대상 8세 이상 자녀 수, birth = 올해 출산·입양한 자녀가 몇째인지(0이면 없음)
  function childTaxCredit(kids, birth) {
    let c = kids <= 0 ? 0 : kids === 1 ? 25 * MAN : 55 * MAN + Math.max(0, kids - 2) * 40 * MAN;
    if (birth) c += [0, 30, 50, 70][Math.min(3, birth)] * MAN;
    return c;
  }
  // 신용카드 등 소득공제 (조특법 제126조의2 ②⑩⑪, 2026년 사용분). kids = 20세 이하 자녀등 수
  // 총급여 7천만원 초과면 문화체육사용분은 결제수단에 따라 신용·체크에 들어가야 하므로 culture는 신용카드분으로 본다
  function cardDeduction(o) {
    const g = o.gross, low = g <= 7000 * MAN;
    const market = o.market || 0, transit = o.transit || 0, debit = o.debit || 0;
    const culture = low ? (o.culture || 0) : 0;
    const credit = (o.credit || 0) + (low ? 0 : (o.culture || 0));
    const min = g * 0.25;
    const gross = market * 0.4 + transit * 0.4 + culture * 0.3 + debit * 0.3 + credit * 0.15;
    let minus;
    if (min <= credit) minus = min * 0.15;
    else if (min <= credit + debit + culture) minus = credit * 0.15 + (min - credit) * 0.3;
    else minus = credit * 0.15 + (debit + culture) * 0.3 + (min - credit - debit - culture) * 0.4;
    const amount = Math.max(0, gross - minus);
    const kids = o.kids || 0;
    const limit = (low ? [300, 350, 400] : [250, 275, 300])[Math.min(2, kids)] * MAN;
    const special = Math.min(market * 0.4 + transit * 0.4 + culture * 0.3, (low ? 300 : 200) * MAN);
    const extra = amount > limit ? Math.min(amount - limit, special) : 0;
    return { min, used: o.credit + debit + market + transit + (o.culture || 0), gross, amount, limit, extra,
      deduction: Math.min(amount, limit) + extra };
  }
  // 의료비: 일반(700만원 한도) + 본인·65세 이상·6세 이하·장애인 등(한도 없음), 총급여 3% 초과분의 15%
  function medicalCredit(g, general, special) {
    const th = g * 0.03;
    const base = general >= th ? Math.min(general - th, 700 * MAN) + special : Math.max(0, special - (th - general));
    return base * 0.15;
  }
  function yearEndTax(o) {
    const g = o.gross;
    const n = (k) => Math.max(0, o[k] || 0);
    const eid = earnedIncomeDeduction(g);
    const income = Math.max(0, g - eid);
    let personal = 150 * MAN * Math.max(1, n('people')) + 100 * MAN * n('elderly') + 200 * MAN * n('disabled');
    if (o.singleParent) personal += 100 * MAN;
    else if (o.woman && income <= 3000 * MAN) personal += 50 * MAN;
    const pension = n('pension');
    const card = cardDeduction({ gross: g, credit: n('credit'), debit: n('debit'), market: n('market'), transit: n('transit'),
      culture: n('culture'), kids: n('kids20') });
    // 공통 세액공제
    const child = childTaxCredit(n('kids8'), n('birth'));
    const pensionRate = g <= 5500 * MAN ? 0.15 : 0.12;
    const savings = Math.min(n('pensionSavings'), 600 * MAN);
    const pensionAcct = Math.min(savings + n('irp'), 900 * MAN) * pensionRate;
    const marriage = o.marriage ? 50 * MAN : 0;
    // 특별공제를 받는 경우(A)와 표준세액공제를 받는 경우(B) 중 세금이 적은 쪽
    function scenario(itemized) {
      const special = itemized ? n('insurance4') : 0;
      const base = Math.max(0, income - personal - pension - special - card.deduction);
      const tax = incomeTax(base);
      const credits = { earned: earnedTaxCredit(tax, g), child, pension: pensionAcct, marriage, insurance: 0, medical: 0,
        education: 0, donation: 0, rent: 0, standard: 0 };
      if (itemized) {
        credits.insurance = Math.min(n('insurance'), 100 * MAN) * 0.12;
        credits.medical = medicalCredit(g, n('medicalGeneral'), n('medicalSpecial'));
        credits.education = n('education') * 0.15;
        const d = n('donation');
        credits.donation = Math.min(d, 1000 * MAN) * 0.15 + Math.max(0, d - 1000 * MAN) * 0.3;
        if (o.rentEligible && g <= 8000 * MAN) credits.rent = Math.min(n('rent'), 1000 * MAN) * (g <= 5500 * MAN ? 0.17 : 0.15);
      } else credits.standard = 13 * MAN;
      const totalCredit = Object.values(credits).reduce((a, b) => a + b, 0);
      const decided = Math.floor(Math.max(0, tax - totalCredit));
      return { itemized, base, tax, credits, totalCredit, decided };
    }
    const A = scenario(true), B = scenario(false);
    const best = B.decided < A.decided ? B : A;
    const local = Math.floor(best.decided * 0.1);
    const r = { gross: g, eid, income, personal, pension, card, A, B, best, decided: best.decided, local };
    if (o.prepaid != null && o.prepaid > 0) {
      const prepaidLocal = o.prepaidLocal != null ? o.prepaidLocal : Math.floor(o.prepaid * 0.1);
      r.refund = o.prepaid - best.decided;
      r.refundLocal = prepaidLocal - local;
      r.refundTotal = r.refund + r.refundLocal;
    }
    return r;
  }

  // ---------- 금융 ----------
  // method: 'annuity'(원리금균등) | 'principal'(원금균등) | 'bullet'(만기일시)
  function loan(P, ratePct, n, method) {
    const r = ratePct / 100 / 12;
    const pmt = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
    const rows = [];
    let bal = P, totalInterest = 0;
    for (let k = 1; k <= n; k++) {
      const interest = bal * r;
      let principal;
      if (k === n) principal = bal;
      else if (method === 'annuity') principal = pmt - interest;
      else if (method === 'principal') principal = P / n;
      else principal = 0;
      bal -= principal;
      totalInterest += interest;
      rows.push({ k, payment: principal + interest, principal, interest, balance: Math.max(0, bal) });
    }
    return { rows, totalInterest, totalPayment: P + totalInterest };
  }

  // kind: 'installment'(적금, 매월 amount 납입) | 'deposit'(예금, amount 일시 예치)
  function savings(o) {
    const r = o.ratePct / 100 / 12, n = o.months;
    let principal, interest;
    if (o.kind === 'installment') {
      principal = o.amount * n;
      if (o.compound) {
        interest = 0;
        for (let k = 1; k <= n; k++) interest += o.amount * (Math.pow(1 + r, k) - 1);
      } else {
        interest = o.amount * r * n * (n + 1) / 2;
      }
    } else {
      principal = o.amount;
      interest = o.compound ? o.amount * (Math.pow(1 + r, n) - 1) : o.amount * r * n;
    }
    const tax = Math.floor(interest * o.taxRate);
    return { principal, interest, tax, net: interest - tax, total: principal + interest - tax };
  }

  // ---------- 생활 ----------
  // 2월 29일생은 평년에 2월 28일로 본다
  function birthdayIn(year, birth) {
    const last = new Date(year, birth.getMonth() + 1, 0).getDate();
    return new Date(year, birth.getMonth(), Math.min(birth.getDate(), last));
  }
  function age(birth, ref) {
    let next = birthdayIn(ref.getFullYear(), birth);
    if (toUTC(next) < toUTC(ref)) next = birthdayIn(ref.getFullYear() + 1, birth);
    return {
      man: fullYears(birth, ref),
      year: ref.getFullYear() - birth.getFullYear(),
      counting: ref.getFullYear() - birth.getFullYear() + 1,
      daysLived: daysBetween(birth, ref),
      nextBirthday: next,
      untilBirthday: daysBetween(ref, next),
    };
  }

  // 한국 기준(대한비만학회)
  function bmi(cm, kg) {
    const v = kg / Math.pow(cm / 100, 2);
    let label;
    if (v < 18.5) label = '저체중';
    else if (v < 23) label = '정상';
    else if (v < 25) label = '비만 전단계(과체중)';
    else if (v < 30) label = '1단계 비만';
    else if (v < 35) label = '2단계 비만';
    else label = '3단계 비만(고도비만)';
    const m2 = Math.pow(cm / 100, 2);
    return { value: v, label, normalMin: 18.5 * m2, normalMax: 22.9 * m2 };
  }

  // ---------- 자동차세 (비영업용 승용) ----------
  // 근거: 지방세법 제127조·제128조·제151조, 시행령 제122조·제125조 (2026-11 기준)
  const CAR_TAX = { prepayRate: 0.05, eduRate: 0.3, otherCarTax: 100000 };
  function carCcRate(cc) { return cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200; }
  // 차령: 기산일이 상반기면 과세연도-기산연도+1, 하반기면 1기분은 +0, 2기분은 +1
  function carAge(start, year, half) {
    const n = year - start.getFullYear() + (start.getMonth() < 6 || half === 2 ? 1 : 0);
    return Math.min(12, n);
  }
  // 기분세액 = A/2 - (A/2 × 5%)(n-2), 차령 3년 이상부터 적용
  function carHalfTax(A, n) { return A / 2 - A / 2 * 0.05 * Math.max(0, n - 2); }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  // o: { kind: 'cc'|'other', cc, start(Date, 차령기산일), year, month(1|3|6|9) }
  function carTax(o) {
    const other = o.kind === 'other';
    const A = other ? CAR_TAX.otherCarTax : o.cc * carCcRate(o.cc);
    const n1 = other ? 0 : Math.max(0, carAge(o.start, o.year, 1));
    const n2 = other ? 0 : Math.max(0, carAge(o.start, o.year, 2));
    const h1 = other ? A / 2 : carHalfTax(A, n1), h2 = other ? A / 2 : carHalfTax(A, n2);
    const annual = h1 + h2;
    const days = isLeap(o.year) ? 366 : 365;
    const r = CAR_TAX.prepayRate;
    // 납부기한 다음 날~12월 31일 일수: 1월 납부는 2/1부터, 3월 납부는 4/1부터
    const rest = (m) => days - daysBetween(new Date(o.year, 0, 1), new Date(o.year, m, 1));
    let base, deduction;
    if (o.month === 1 || o.month === 3) { base = annual; deduction = annual * rest(o.month) / days * r; }
    else if (o.month === 6) { base = annual; deduction = h2 * r; }
    else if (o.month === 9) { base = h2; deduction = h2 * rest(9) / 184 * r; }
    const edu = (x) => x * CAR_TAX.eduRate;
    const res = { A, rate: other ? 0 : carCcRate(o.cc), n1, n2, h1, h2, annual, edu: edu(annual), total: annual + edu(annual) };
    if (base != null) {
      res.prepay = { base, deduction, tax: base - deduction, edu: edu(base - deduction), pay: (base - deduction) * (1 + CAR_TAX.eduRate),
        saving: deduction * (1 + CAR_TAX.eduRate), effRate: deduction / base };
    }
    return res;
  }

  // ---------- 표시 ----------
  function comma(n, digits) {
    if (!isFinite(n)) return '-';
    return n.toLocaleString('ko-KR', { maximumFractionDigits: digits == null ? 0 : digits });
  }
  function won(n) { return comma(Math.round(n)) + '원'; }
  // 123456789 -> "1억 2,345만 6,789"
  function korean(n) {
    n = Math.round(n);
    if (Math.abs(n) < 10000) return comma(n);
    const sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    const parts = [];
    const jo = Math.floor(n / 1e12), eok = Math.floor(n % 1e12 / 1e8), man = Math.floor(n % 1e8 / 1e4), rest = n % 1e4;
    if (jo) parts.push(comma(jo) + '조');
    if (eok) parts.push(comma(eok) + '억');
    if (man) parts.push(comma(man) + '만');
    if (rest) parts.push(comma(rest));
    return sign + parts.join(' ');
  }

  global.Calc = {
    PYEONG, parseDate, daysBetween, addDays, addMonths, fullYears, fullMonths, fmtDate,
    severance, annualLeave, weeklyHolidayHours, monthlyHours, loan, savings, age, bmi,
    UNEMPLOYMENT: UI_RULES, unemployment, parentalLeave, brokerage, BASE_RATE, legalConversionRate, SERVICE, discharge,
    earnedIncomeDeduction, incomeTax, earnedTaxCredit, childTaxCredit, cardDeduction, medicalCredit, yearEndTax,
    CAR_TAX, carCcRate, carAge, carTax,
    comma, won, korean,
  };

  // ---------- 화면 연결 ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function num(id) {
    const el = $(id);
    if (!el) return 0;
    const v = parseFloat(String(el.value).replace(/,/g, ''));
    return isFinite(v) ? v : 0;
  }
  function date(id) { return parseDate($(id).value); }
  function val(id) {
    const el = $(id);
    if (el) return el.value;
    const checked = document.querySelector(`input[name="${id}"]:checked`);
    return checked ? checked.value : '';
  }
  function today(id) {
    const d = new Date();
    $(id).value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 금액 입력칸에 천 단위 쉼표를 넣고, 커서 위치는 숫자 개수 기준으로 유지
  function formatMoneyInput(el) {
    const pos = el.selectionStart || 0;
    const digitsBefore = el.value.slice(0, pos).replace(/[^\d]/g, '').length;
    const raw = el.value.replace(/[^\d]/g, '');
    el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    let i = 0, seen = 0;
    while (i < el.value.length && seen < digitsBefore) { if (/\d/.test(el.value[i])) seen++; i++; }
    try { el.setSelectionRange(i, i); } catch (e) { /* 포커스 없는 경우 */ }
    const hint = el.parentElement.querySelector('.unit-hint');
    if (hint) hint.textContent = raw && Number(raw) >= 10000 ? korean(Number(raw)) + '원' : '';
  }

  // headline: [라벨, 값], rows: [[라벨, 값], ...], notes: [문장, ...]
  function result(headline, rows, notes) {
    let h = '';
    if (headline) h += `<div class="headline"><span>${esc(headline[0])}</span><strong>${headline[1]}</strong></div>`;
    if (rows && rows.length) {
      h += '<dl class="rows">' + rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('') + '</dl>';
    }
    (notes || []).forEach((n) => { h += `<p class="note">${n}</p>`; });
    return h;
  }

  // compute()가 HTML을 돌려주면 표시, null이면 안내 문구, 예외면 오류 문구
  function bind(formId, outId, compute) {
    const form = $(formId), out = $(outId);
    const placeholder = '<p class="hint">값을 입력하면 바로 계산됩니다.</p>';
    function run() {
      try {
        const html = compute();
        out.innerHTML = html || placeholder;
        out.classList.toggle('filled', !!html);
      } catch (e) {
        out.innerHTML = `<p class="error">${esc(e.message)}</p>`;
        out.classList.remove('filled');
      }
    }
    form.querySelectorAll('input.money').forEach((el) => {
      if (!el.parentElement.querySelector('.unit-hint')) {
        const s = document.createElement('span');
        s.className = 'unit-hint';
        el.insertAdjacentElement('afterend', s);
      }
      el.addEventListener('input', () => formatMoneyInput(el));
      if (el.value) formatMoneyInput(el);
    });
    form.addEventListener('input', run);
    form.addEventListener('change', run);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      run();
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    run();
  }

  global.UI = { $, esc, num, date, val, today, result, bind };
})(window);
