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

// 연말정산 2026 귀속 (손으로 계산한 값)
eq('eid 5천', C.earnedIncomeDeduction(5e7), 12250000); eq('eid 4천', C.earnedIncomeDeduction(4e7), 11250000); eq('eid 2억', C.earnedIncomeDeduction(2e8), 16750000);
eq('eid cap', C.earnedIncomeDeduction(4e8), 2e7);
eq('tax 1400', C.incomeTax(1.4e7), 840000); eq('tax 1억', C.incomeTax(1e8), 19560000); eq('tax 12억', C.incomeTax(1.2e9), 474060000);
eq('etc 1억 floor', C.earnedTaxCredit(19560000, 1e8), 500000); eq('etc 5천', C.earnedTaxCredit(3465000, 5e7), 660000);
eq('etc small', C.earnedTaxCredit(1000000, 3e7), 550000);
eq('child 3', C.childTaxCredit(3, 0), 950000); eq('child 1 + 둘째 출산', C.childTaxCredit(1, 2), 750000);
var cd = C.cardDeduction({ gross: 4e7, credit: 1.5e7, debit: 6e6, market: 1e6, transit: 5e5, culture: 0, kids: 0 });
eq('card amount', cd.amount, 3150000); eq('card extra', cd.extra, 150000); eq('card ded', cd.deduction, 3150000);
eq('card min in debit', C.cardDeduction({ gross: 6e7, credit: 1e7, debit: 1e7 }).deduction, 1500000);
eq('card min in market', C.cardDeduction({ gross: 4e7, credit: 0, debit: 2e6, market: 1e7 }).deduction, 800000);
eq('card 8천 kids2', C.cardDeduction({ gross: 8e7, credit: 5e7, market: 3e6, kids: 2 }).deduction, 4200000);
eq('medical', C.medicalCredit(5e7, 1e6, 3e6), 375000);
var ye = C.yearEndTax({ gross: 5e7, people: 1, pension: 2250000, insurance4: 2e6, prepaid: 3e6 });
eq('ye A', ye.A.decided, 2880000); eq('ye B', ye.B.decided, 3050000); eq('ye best', ye.decided, 2880000);
eq('ye refund', ye.refund, 120000); var ys = C.yearEndTax({ gross: 3e7, people: 1, pension: 1350000 }); eq('ye std wins', ys.decided, 490000); eq('ye std flag', ys.best.itemized, false); eq('ye rent', C.yearEndTax({ gross: 3e7, people: 1, pension: 1350000, rentEligible: true, rent: 6e6 }).decided, 0); eq('ye refund total', ye.refundTotal, 132000);

// 자동차세 (손으로 계산한 값)
var ct = C.carTax({ kind: 'cc', cc: 1998, start: D('2025-03-10'), year: 2027, month: 1 });
eq('car age 3', ct.n1, 3); eq('car half', ct.h1, 189810); eq('car annual', ct.annual, 379620); eq('car total', ct.total, 493506);
eq('car jan ded', ct.prepay.deduction, 17368.92, 0.01); eq('car jan pay', ct.prepay.pay, 470926.41, 0.01);
var co = C.carTax({ kind: 'cc', cc: 999, start: D('2010-05-01'), year: 2027 });
eq('car old cap12', co.n2, 12); eq('car old annual', co.annual, 39960); eq('car old total', co.total, 51948); eq('car no prepay', co.prepay, undefined);
eq('car 1600', C.carTax({ kind: 'cc', cc: 1600, start: D('2027-01-05'), year: 2027 }).annual, 224000);
eq('car 1601', C.carTax({ kind: 'cc', cc: 1601, start: D('2027-01-05'), year: 2027 }).annual, 320200);
var ch = C.carTax({ kind: 'cc', cc: 2000, start: D('2026-09-01'), year: 2028, month: 9 });
eq('car 2H n1', ch.n1, 2); eq('car 2H n2', ch.n2, 3); eq('car 2H annual', ch.annual, 390000); eq('car sep ded', ch.prepay.deduction, 4750);
eq('car jun ded', C.carTax({ kind: 'cc', cc: 2000, start: D('2026-09-01'), year: 2028, month: 6 }).prepay.deduction, 9500);
eq('car leap jan', C.carTax({ kind: 'cc', cc: 2000, start: D('2026-09-01'), year: 2028, month: 1 }).prepay.deduction, 17848.36, 0.01);
var ce = C.carTax({ kind: 'other', year: 2027, month: 3 });
eq('car ev total', ce.total, 130000); eq('car ev mar ded', ce.prepay.deduction, 3767.12, 0.01);

// 주택청약 가점 (주택공급에 관한 규칙 별표 1, 손으로 계산한 값)
var R = D('2026-11-04');
var h1 = C.housingScore({ ref: R, birth: D('1990-03-15'), married: false, owns: false, dependents: 0, account: D('2015-01-10') });
eq('hs single hMonths', h1.hMonths, 79); eq('hs single homeless', h1.homeless, 14); eq('hs single dep', h1.dependents, 5);
eq('hs single acct', h1.account, 13); eq('hs single total', h1.total, 32);
var h2 = C.housingScore({ ref: R, birth: D('1995-06-01'), married: true, marriage: D('2022-05-20'), owns: false, dependents: 2, account: D('2020-01-01'), spouseAccount: D('2023-01-01') });
eq('hs marriage start', ymd(h2.start), '2022-5-20'); eq('hs marriage homeless', h2.homeless, 10); eq('hs own acct', h2.own, 8);
eq('hs spouse 3', h2.spouse, 3); eq('hs marriage total', h2.total, 36);
eq('hs spouse 10m', C.spouseAccountPoints(10), 1); eq('hs spouse 18m', C.spouseAccountPoints(18), 2); eq('hs spouse 24m', C.spouseAccountPoints(24), 3);
var h3 = C.housingScore({ ref: R, birth: D('1980-01-01'), married: true, marriage: D('2008-10-10'), owns: false, homelessSince: D('2018-03-01'), dependents: 3, account: D('2005-01-01'), spouseAccount: D('2005-01-01') });
eq('hs disposal homeless', h3.homeless, 18); eq('hs acct cap 17', h3.account, 17); eq('hs disposal total', h3.total, 55);
var h4 = C.housingScore({ ref: R, birth: D('2000-05-05'), married: false, owns: false, dependents: 0, account: D('2026-07-01') });
eq('hs under30 homeless', h4.homeless, 0); eq('hs 4m acct', h4.account, 1); eq('hs under30 total', h4.total, 6);
eq('hs max', C.housingScore({ ref: R, birth: D('1970-01-01'), married: false, owns: false, dependents: 6, account: D('2000-01-01') }).total, 84);
eq('hs owns', C.housingScore({ ref: R, birth: D('1970-01-01'), married: false, owns: true, dependents: 1, account: D('2000-01-01') }).homeless, 0);
eq('hs 1y boundary', C.homelessPoints(C.fullMonths(D('2025-11-04'), R)), 4); eq('hs 11m', C.homelessPoints(11), 2);
eq('hs acct 6m boundary', C.accountPoints(C.fullMonths(D('2026-05-04'), R)), 2); eq('hs acct 15y', C.accountPoints(180), 17); eq('hs acct 14y11m', C.accountPoints(179), 16);
eq('hs dep 7', C.dependentPoints(7), 35);

// 연금저축·IRP 세액공제 (소득세법 제59조의3, 손으로 계산한 값)
var MAN = 10000;
var p1 = C.pensionCredit({ incomeType: 'wage', income: 5000 * MAN, savings: 600 * MAN, irp: 300 * MAN });
eq('pc 15% credit', p1.credit, 1350000); eq('pc 15% refund', p1.refund, 1485000); eq('pc full room', p1.totalRoom, 0);
var p2 = C.pensionCredit({ incomeType: 'wage', income: 5500 * MAN + 1, savings: 800 * MAN, irp: 200 * MAN });
eq('pc 12% sav cap', p2.base, 800 * MAN); eq('pc 12% credit', p2.credit, 960000); eq('pc excess', p2.excess, 200 * MAN);
eq('pc 5500 boundary', C.pensionCredit({ incomeType: 'wage', income: 5500 * MAN, irp: 100 * MAN }).rate, 0.15);
var p3 = C.pensionCredit({ incomeType: 'total', income: 5000 * MAN, savings: 300 * MAN, irp: 100 * MAN });
eq('pc total 12%', p3.rate, 0.12); eq('pc room', p3.totalRoom, 500 * MAN); eq('pc sav room', p3.savingsRoom, 300 * MAN);
eq('pc room refund', p3.roomRefund, 660000);
var p4 = C.pensionCredit({ incomeType: 'wage', income: 4000 * MAN, savings: 600 * MAN, irp: 300 * MAN, isa: 2500 * MAN });
eq('pc isa extra', p4.isaExtra, 250 * MAN); eq('pc isa credit', p4.credit, 1725000);
eq('pc isa cap 300', C.pensionCredit({ incomeType: 'wage', income: 4000 * MAN, isa: 5000 * MAN }).isaExtra, 300 * MAN);
eq('pc isa prev', C.pensionCredit({ incomeType: 'wage', income: 4000 * MAN, isa: 5000 * MAN, isaPrev: 200 * MAN }).isaExtra, 100 * MAN);
var p5 = C.pensionCredit({ incomeType: 'wage', income: 3000 * MAN, savings: 600 * MAN, taxCap: 500000 });
eq('pc tax cap', p5.credit, 500000); eq('pc tax cap flag', p5.capped, true); eq('pc tax cap local', p5.local, 50000);
eq('pc tax cap room 0', p5.roomRefund, 0);
eq('pc partial cap room', C.pensionCredit({ incomeType: 'wage', income: 4000 * MAN, savings: 400 * MAN, taxCap: 1000000 }).roomRefund, 440000);

// 중도상환수수료 (금소법 제20조 3년 규칙, 손으로 계산한 값)
var pf = C.prepaymentFee({ amount: 1e8, ratePct: 0.6, start: D('2025-03-01'), repay: D('2026-11-06') });
eq('pf window days', pf.windowDays, 1096); eq('pf remaining', pf.remaining, 481); eq('pf fee', pf.fee, 263321, 0);
eq('pf window end', ymd(pf.windowEnd), '2028-3-1');
eq('pf after 3y', C.prepaymentFee({ amount: 1e8, ratePct: 0.6, start: D('2023-01-10'), repay: D('2026-01-10') }).fee, 0);
eq('pf after 3y flag', C.prepaymentFee({ amount: 1e8, ratePct: 0.6, start: D('2023-01-10'), repay: D('2026-02-01') }).exempt, true);
var ps = C.prepaymentFee({ amount: 2e7, ratePct: 0.11, start: D('2024-06-01'), end: D('2026-06-01'), repay: D('2025-06-01') });
eq('pf short term days', ps.windowDays, 730); eq('pf short term fee', ps.fee, 11000, 0);
eq('pf free amount', C.prepaymentFee({ amount: 5e7, free: 1e7, ratePct: 0.5, start: D('2026-01-01'), repay: D('2026-01-01') }).fee, 200000, 0);
eq('pf free covers all', C.prepaymentFee({ amount: 5e6, free: 1e7, ratePct: 0.5, start: D('2026-01-01'), repay: D('2026-05-01') }).fee, 0);
eq('pf wait interest', C.prepaymentFee({ amount: 1e8, ratePct: 0.6, loanRatePct: 4, start: D('2025-03-01'), repay: D('2026-11-06') }).waitInterest, 5271232.88, 0.01);

// 퇴직소득세 (소득세법 제48조·제55조②, 손으로 계산한 값)
var rt = C.retirementTax({ pay: 1e8, years: 20 });
eq('rt 20y svc', rt.svcDed, 4000 * MAN); eq('rt 20y conv', rt.converted, 3600 * MAN); eq('rt 20y convded', rt.convDed, 2480 * MAN);
eq('rt 20y base', rt.base, 1120 * MAN); eq('rt 20y tax', rt.tax, 1120000, 0); eq('rt 20y local', rt.local, 112000, 0);
eq('rt 20y pension', rt.pension10, 784000, 0);
var r5 = C.retirementTax({ pay: 1e8, years: 5 });
eq('rt 5y conv', r5.converted, 22800 * MAN); eq('rt 5y convded', r5.convDed, 11930 * MAN); eq('rt 5y tax', r5.tax, 9418750, 0);
eq('rt 10y 3000', C.retirementTax({ pay: 3000 * MAN, years: 10 }).tax, 200000, 0);
eq('rt 2y 1000', C.retirementTax({ pay: 1000 * MAN, years: 2 }).tax, 190000, 0);
eq('rt conv under 800', C.retirementTax({ pay: 500 * MAN, years: 3 }).tax, 0);
eq('rt pay under svc', C.retirementTax({ pay: 200 * MAN, years: 3 }).svcDed, 200 * MAN);
eq('rt 25y svc', C.serviceDeduction(25), 5500 * MAN); eq('rt conv 3.5e', C.convertedPayDeduction(35000 * MAN), 16920 * MAN);
eq('rt years exact', C.serviceYears(D('2016-03-02'), D('2026-03-01')), 10);
eq('rt years +1day', C.serviceYears(D('2016-03-02'), D('2026-03-02')), 11);
eq('rt years short', C.serviceYears(D('2025-01-01'), D('2025-06-30')), 1);
eq('rt dates', C.retirementTax({ pay: 1e8, start: D('2006-01-02'), last: D('2025-12-31') }).tax, 1120000, 0);

// 4대보험 (2026년 요율, 손으로 계산한 값)
var si = C.socialInsurance({ pay: 3000000 });
eq('si pension', si.pension, 142500, 0); eq('si health', si.health, 107850, 0); eq('si ltc', si.ltc, 14172, 0);
eq('si emp', si.empEmployee, 27000, 0); eq('si employer emp', si.empEmployer, 34500, 0); eq('si employee', si.employee, 291522, 0);
eq('si employer', si.employer, 299022, 0);
var sh = C.socialInsurance({ pay: 8000000 });
eq('si cap pension', sh.pension, 313025, 0); eq('si high health', sh.health, 287600, 0); eq('si high ltc', sh.ltc, 37792, 0);
var sl = C.socialInsurance({ pay: 300000 });
eq('si min pension', sl.pension, 19475, 0); eq('si low health', sl.health, 10785, 0); eq('si low ltc', sl.ltc, 1417, 0);
eq('si health floor', C.socialInsurance({ pay: 200000 }).health, 10080, 0);
eq('si before july', C.socialInsurance({ pay: 2555555, at: D('2026-03-01') }).pension, 121362, 0);
eq('si before july cap', C.socialInsurance({ pay: 7000000, at: D('2026-03-01') }).pension, 302575, 0);
eq('si large employer', C.socialInsurance({ pay: 5000000, size: 'large' }).empEmployer, 87500, 0);
eq('si accident', C.socialInsurance({ pay: 3000000, accidentPct: 1.47 }).accident, 44100, 0);
var s60 = C.socialInsurance({ pay: 3000000, noPension: true, lateHire: true });
eq('si 60 pension', s60.pension, 0); eq('si late emp', s60.empEmployee, 0); eq('si late employer', s60.empEmployer, 7500, 0);

if (typeof window.extraTests === 'function') window.extraTests(eq, C, D);
log((fails ? 'FAILED ' : 'OK ') + (total - fails) + '/' + total);
if (fails) { if (isNode) process.exit(1); else throw new Error('tests failed'); }
