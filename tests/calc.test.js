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

if (typeof window.extraTests === 'function') window.extraTests(eq, C, D);
log((fails ? 'FAILED ' : 'OK ') + (total - fails) + '/' + total);
if (fails) { if (isNode) process.exit(1); else throw new Error('tests failed'); }
