// 계산 로직 회귀 테스트. 실행: ./test.sh (macOS 내장 jsc) 또는 node tests/calc.test.js
var isNode = typeof require === 'function' && typeof process === 'object';
var window = this;
if (isNode) {
  window = globalThis.window = globalThis;
  require('vm').runInThisContext(require('fs').readFileSync(require('path').join(__dirname, '../assets/calc.js'), 'utf8'));
} else {
  load(arguments[0] || 'assets/calc.js');
}
var log = isNode ? console.log : print;
var fails = 0, total = 0;
function eq(name, got, want, tol) {
  tol = tol == null ? 0.5 : tol;
  total++;
  var ok = typeof want === 'number' ? Math.abs(got - want) <= tol : got === want;
  if (!ok) { fails++; log('FAIL ' + name + ' got=' + got + ' want=' + want); }
}
var C = window.Calc, D = C.parseDate;

// 퇴직금: 2년(731일), 3개월 900만원, 3개월 총일수 92일
var s = C.severance({ start: D('2023-01-01'), end: D('2025-01-01'), wage3m: 9000000 });
eq('sev days', s.days, 731); eq('sev days3m', s.days3m, 92); eq('sev amount', s.amount, 9000000 / 92 * 30 * 731 / 365, 0.01);
// 연차
eq('leave 6mo', C.annualLeave(D('2025-01-15'), D('2025-07-15')).days, 6);
eq('leave 11mo cap', C.annualLeave(D('2025-01-01'), D('2025-12-31')).days, 11);
eq('leave 1y', C.annualLeave(D('2024-01-01'), D('2025-01-01')).days, 15);
eq('leave 3y', C.annualLeave(D('2022-01-01'), D('2025-01-01')).days, 16);
eq('leave 21y', C.annualLeave(D('2000-01-01'), D('2021-01-01')).days, 25);
eq('leave 30y', C.annualLeave(D('1990-01-01'), D('2020-01-01')).days, 25);
// 주휴·월 환산
eq('hh 40', C.weeklyHolidayHours(40), 8); eq('hh 20', C.weeklyHolidayHours(20), 4);
eq('hh 14', C.weeklyHolidayHours(14), 0); eq('hh 50', C.weeklyHolidayHours(50), 8);
eq('mh 40', C.monthlyHours(40), 209); eq('mh 20', C.monthlyHours(20), 104);
// 대출: 1억, 4.5%, 360개월 원리금균등 월 506,685원
var L = C.loan(1e8, 4.5, 360, 'annuity');
eq('annuity pmt', L.rows[0].payment, 506685, 1); eq('annuity end', L.rows[359].balance, 0, 0.01);
var Lp = C.loan(12e6, 6, 12, 'principal');
eq('principal first', Lp.rows[0].payment, 1060000); eq('principal int', Lp.totalInterest, 390000, 0.01);
var Lb = C.loan(1e7, 6, 12, 'bullet');
eq('bullet int', Lb.totalInterest, 600000, 0.01); eq('bullet last', Lb.rows[11].payment, 10050000, 0.01);
eq('zero rate', C.loan(1200, 0, 12, 'annuity').rows[0].payment, 100, 0.001);
// 적금: 월 100만, 5%, 12개월 단리 → 이자 325,000
var sv = C.savings({ kind: 'installment', amount: 1e6, ratePct: 5, months: 12, compound: false, taxRate: 0.154 });
eq('inst int', sv.interest, 325000, 0.01); eq('inst tax', sv.tax, 50050);
eq('deposit', C.savings({ kind: 'deposit', amount: 1e7, ratePct: 3, months: 12, compound: false, taxRate: 0 }).interest, 300000, 0.01);
// 나이·날짜
var a = C.age(D('2000-11-01'), D('2026-10-31'));
eq('age man', a.man, 25); eq('age year', a.year, 26); eq('until bday', a.untilBirthday, 1);
var a2 = C.age(D('2000-02-29'), D('2027-03-01'));
eq('leap next', a2.nextBirthday.getFullYear(), 2028); eq('leap man', a2.man, 27);
eq('addMonths eom', C.addMonths(D('2025-03-31'), -1).getDate(), 28);
eq('100th day', C.daysBetween(D('2026-01-01'), C.addDays(D('2026-01-01'), 99)), 99);
eq('bmi', C.bmi(170, 65).value, 22.49, 0.01);
eq('korean', C.korean(123456789), '1억 2,345만 6,789');

// 실업급여 (2026): 3개월 92일
var u = C.unemployment({ end: D('2026-10-01'), wage3m: 9000000, over50: false, insured: 1, dailyHours: 8 });
eq('ue days3m', u.days3m, 92); eq('ue floor daily', u.daily, 66048); eq('ue days', u.payDays, 150); eq('ue total', u.total, 9907200);
var u2 = C.unemployment({ end: D('2026-10-01'), wage3m: 15000000, over50: true, insured: 4, dailyHours: 8 });
eq('ue cap daily', u2.daily, 68100); eq('ue cap total', u2.total, 18387000);
eq('ue 4h floor', C.unemployment({ end: D('2026-10-01'), wage3m: 3000000, over50: false, insured: 0, dailyHours: 4 }).daily, 33024);
// 육아휴직
eq('pl 12m', C.parentalLeave(3000000, 12, false).total, 23100000);
eq('pl floor', C.parentalLeave(800000, 7, false).total, 5500000);
eq('pl 6+6 max', C.parentalLeave(5000000, 6, true).total, 20000000);
eq('pl 6+6 mid', C.parentalLeave(3200000, 6, true).total, 17600000);
// 중개보수
eq('br sale 5억', C.brokerage('sale', 5e8).fee, 2000000);
eq('br sale 1억', C.brokerage('sale', 1e8).fee, 500000);
eq('br sale 1.8억 cap', C.brokerage('sale', 1.8e8).fee, 800000);
eq('br sale 2억 boundary', C.brokerage('sale', 2e8).fee, 800000);
eq('br sale 10억', C.brokerage('sale', 1e9).fee, 5000000);
eq('br jeonse 3억', C.brokerage('lease', 0, 3e8, 0).fee, 900000);
eq('br monthly x100', C.brokerage('lease', 0, 1e7, 5e5).fee, 240000);
var bm = C.brokerage('lease', 0, 5e6, 3e5);
eq('br monthly x70 amount', bm.amount, 26000000); eq('br monthly x70 fee', bm.fee, 130000);
// 전월세 전환율
eq('conv legal', C.legalConversionRate(), 5); eq('conv cap 10', C.legalConversionRate(9), 10);
// 전역일
function ymd(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
eq('dc army', ymd(C.discharge(D('2026-01-05'), 18)), '2027-7-4');
eq('dc eom', ymd(C.discharge(D('2025-08-31'), 18)), '2027-2-28');
eq('dc social', ymd(C.discharge(D('2026-03-01'), 21)), '2027-11-30');
eq('dc 30th', ymd(C.discharge(D('2024-05-30'), 18)), '2025-11-29');
eq('dc 31st', ymd(C.discharge(D('2024-05-31'), 18)), '2025-11-30');

if (typeof window.extraTests === 'function') window.extraTests(eq, C, D);
log((fails ? 'FAILED ' : 'OK ') + (total - fails) + '/' + total);
if (fails) { if (isNode) process.exit(1); else throw new Error('tests failed'); }
