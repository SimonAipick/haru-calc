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

// 대출 갈아타기: 인지세(인지세법 제3조①2호·제6조8호)
eq('stamp 1e7', C.loanStampTax(1e7), 0); eq('stamp 5e7', C.loanStampTax(5e7), 0); eq('stamp 5e7+1', C.loanStampTax(50000001), 70000);
eq('stamp 1e8', C.loanStampTax(1e8), 70000); eq('stamp 1.5e8', C.loanStampTax(1.5e8), 150000); eq('stamp 1e9', C.loanStampTax(1e9), 150000); eq('stamp 1.2e9', C.loanStampTax(1.2e9), 350000);
// 원금균등 1,200만원 12개월 6% → 3%: 이자 390,000 → 195,000. 월 이자 차이 2,500×(13-k), 누적 30,000·57,500·82,500·105,000 → 비용 10만원은 4개월째 회수
var rf = C.refinance({ balance: 12e6, months: 12, curRatePct: 6, newRatePct: 3, method: 'principal', fee: 0, costs: 100000 });
eq('rf principal saving', rf.saving, 95000, 0.01); eq('rf principal breakeven', rf.breakeven, 4);
// 만기일시 1억 12개월 5% → 4%: 이자 차이 100만원, 수수료 30만 + 인지세 절반 7.5만 → 62.5만원 이득, 월 83,333원씩 → 5개월째 37.5만원 회수
var rb = C.refinance({ balance: 1e8, months: 12, curRatePct: 5, newRatePct: 4, method: 'bullet', fee: 300000, costs: 75000 });
eq('rf bullet saving', rb.saving, 625000, 0.01); eq('rf bullet breakeven', rb.breakeven, 5);
// 원리금균등 1억 360개월 4.5% → 3.5%: 월 506,685.31 → 449,044.69, 총이자 차이 (506,685.31-449,044.69)×360 = 20,750,623.93
var ra = C.refinance({ balance: 1e8, months: 360, curRatePct: 4.5, newRatePct: 3.5, method: 'annuity', fee: 300000, costs: 75000 });
eq('rf annuity cur pmt', ra.curFirst, 506685.31, 0.01); eq('rf annuity new pmt', ra.newFirst, 449044.69, 0.01); eq('rf annuity saving', ra.saving, 20375623.93, 0.05);
// 금리가 같으면 비용만큼 손해, 회수 시점 없음
var rs = C.refinance({ balance: 5e7, months: 60, curRatePct: 4, newRatePct: 4, method: 'annuity', fee: 100000, costs: 0 });
eq('rf same saving', rs.saving, -100000, 0.01); eq('rf same breakeven', rs.breakeven, null);

// 청년도약계좌: 금융위 2024-12-26 기여금 확대(월 최대 3.3만/2.9만/2.5만/2.1만), 손계산
eq('yl c2400', C.youthLeapContribution(700000, '2400', false), 33000);
eq('yl c3600', C.youthLeapContribution(700000, '3600', false), 29000);
eq('yl c4800', C.youthLeapContribution(700000, '4800', false), 25200);
eq('yl c6000', C.youthLeapContribution(700000, '6000', false), 21000);
eq('yl c7500', C.youthLeapContribution(700000, '7500', false), 0);
eq('yl c2400 old', C.youthLeapContribution(700000, '2400', true), 24000);
eq('yl c300k', C.youthLeapContribution(300000, '2400', false), 18000);
var yl = C.youthLeap({ monthly: 700000, bracket: '2400', ratePct: 4.5, oldMonths: 0 });
eq('yl principal', yl.principal, 42000000); eq('yl contrib', yl.contrib, 1980000);
eq('yl interest', yl.interest, 4803750); eq('yl cint', yl.contribInterest, 226462.5);
eq('yl total', yl.total, 49010212.5); eq('yl taxSaved', yl.taxSaved, 774652.725, 0.01);
eq('yl early3y', yl.early3y, 42000000 + 1188000);
var yl2 = C.youthLeap({ monthly: 700000, bracket: '2400', ratePct: 4.5, oldMonths: 12 });
eq('yl old contrib', yl2.contrib, 1872000); eq('yl old cint', yl2.contribInterest, 204390);
eq('yl 7500 contrib', C.youthLeap({ monthly: 500000, bracket: '7500', ratePct: 4.5 }).contrib, 0);
var ylErr = null; try { C.youthLeap({ monthly: 800000, bracket: '2400', ratePct: 4 }); } catch (e) { ylErr = e.message; }
eq('yl over limit', ylErr, '월 납입 한도는 70만원입니다.');


// 학점: 손계산 (4.5 만점 명지대, 4.3 만점 서울대 등급표)
var g1 = C.gpa([{ credits: 3, grade: 'A+' }, { credits: 3, grade: 'B0' }, { credits: 2, grade: 'F' }, { credits: 2, grade: 'P' }], '4.5');
eq('gpa45 raw', g1.raw, 2.8125, 1e-9); eq('gpa45 round', g1.gpa, 2.81); eq('gpa45 graded', g1.gradedCredits, 8); eq('gpa45 earned', g1.earnedCredits, 8);
var g2 = C.gpa([{ credits: 3, grade: 'A-' }, { credits: 3, grade: 'B+' }, { credits: 1, grade: 'A+' }, { credits: 2, grade: 'U' }], '4.3');
eq('gpa43 raw', g2.raw, 25.3 / 7, 1e-9); eq('gpa43 round', g2.gpa, 3.61); eq('gpa43 earned', g2.earnedCredits, 7);
eq('gpa round half', C.gpa([{ credits: 1, grade: 'A+' }, { credits: 1, grade: 'C+' }, { credits: 2, grade: 'B+' }, { credits: 4, grade: 'A0' }], '4.5').gpa, 3.75);
eq('gpa only P', C.gpa([{ credits: 3, grade: 'P' }], '4.5').gpa, null);
var gErr = null; try { C.gpa([{ credits: 3, grade: 'A-' }], '4.5'); } catch (e) { gErr = e.message; }
eq('gpa bad grade', gErr, '4.5 만점에 없는 등급입니다: A-');
eq('gpa conv 45-43', C.gpaConvert(3.8, 4.5, 4.3), 3.6311111, 1e-6); eq('gpa conv pct', C.gpaConvert(3.8, 4.5, 100), 84.4444444, 1e-6);
eq('gpa conv 43-45', C.gpaConvert(4.0, 4.3, 4.5), 4.1860465, 1e-6);
var gt = C.gpaTarget({ current: 3.2, doneCredits: 90, remCredits: 30, target: 3.5, max: 4.5 });
eq('gpa target need', gt.need, 4.4, 1e-9); eq('gpa target possible', gt.possible, true);
var gt2 = C.gpaTarget({ current: 3.2, doneCredits: 90, remCredits: 30, target: 3.6, max: 4.5 });
eq('gpa target impossible', gt2.possible, false); eq('gpa target best', gt2.bestCase, 3.525, 1e-9);


// 주택용 전기요금 (저압, 기후 9.0, 연료비 +5, 기금 2.7%) — 손계산
var eb = C.electricBill({ kwh: 350, month: 11 });
eq('elec 350 nov base', eb.base, 1600); eq('elec 350 nov energy', eb.energy, 56190); eq('elec 350 nov subtotal', eb.subtotal, 62690);
eq('elec 350 nov vat', eb.vat, 6269); eq('elec 350 nov fund', eb.fund, 1690); eq('elec 350 nov total', eb.total, 70640);
eq('elec 350 aug total', C.electricBill({ kwh: 350, month: 8 }).total, 59980);
eq('elec 150 nov total', C.electricBill({ kwh: 150, month: 11 }).total, 23670);
var eb5 = C.electricBill({ kwh: 500, month: 11 }); eq('elec 500 energy', eb5.energy, 97650); eq('elec 500 total', eb5.total, 126160);
var ebs = C.electricBill({ kwh: 1200, month: 1 }); eq('elec 1200 jan super', ebs.isSuper, true); eq('elec 1200 jan energy', ebs.energy, 398540); eq('elec 1200 jan total', ebs.total, 476310);
var ebn = C.electricBill({ kwh: 1200, month: 11 }); eq('elec 1200 nov no super', ebn.isSuper, false); eq('elec 1200 nov total', ebn.total, 379630);
eq('elec high 350 nov total', C.electricBill({ kwh: 350, month: 11, voltage: 'high' }).total, 60010);
eq('elec 200 boundary tier', C.electricBill({ kwh: 200, month: 11 }).tier, 1); eq('elec 201 boundary tier', C.electricBill({ kwh: 201, month: 11 }).tier, 2);
eq('appliance kwh', C.applianceKwh(1000, 4, 30), 120);

// 종합부동산세 (주택분, 개인) — 손계산
var j1 = C.jongbu({ prices: [2000000000], oneHouse: true, age: 50, years: 3 });
eq('jb one base', j1.base, 480000000); eq('jb one calc', j1.calc, 2760000); eq('jb one prop', j1.houses[0].tax, 2970000);
eq('jb one propCredit', j1.propCredit, 864000); eq('jb one tax', j1.tax, 1896000); eq('jb one nong', j1.nong, 379200); eq('jb one pay', j1.pay, 2275200);
var j2 = C.jongbu({ prices: [2000000000], oneHouse: true, age: 66, years: 12 });
eq('jb credit 70%', j2.creditRate, 0.7, 1e-9); eq('jb credit tax', j2.tax, 568800); eq('jb credit nong', j2.nong, 113760);
var j3 = C.jongbu({ prices: [2000000000], oneHouse: true, age: 72, years: 16 });
eq('jb credit cap 80%', j3.creditRate, 0.8, 1e-9); eq('jb cap tax', j3.tax, 379200);
var j4 = C.jongbu({ prices: [1000000000, 800000000], oneHouse: true, age: 70, years: 20 });
eq('jb two not one', j4.one, false); eq('jb two base', j4.base, 540000000); eq('jb two calc', j4.calc, 3180000);
eq('jb two propTotal', j4.propTotal, 3060000); eq('jb two propCredit', j4.propCredit, 1296000); eq('jb two tax', j4.tax, 1884000); eq('jb two pay', j4.pay, 2260800);
var j5 = C.jongbu({ prices: [1500000000, 1200000000, 1000000000] });
eq('jb three heavy', j5.heavy, true); eq('jb three base', j5.base, 1680000000); eq('jb three calc', j5.calc, 19200000);
eq('jb three normal calc', j5.normalCalc, 15840000); eq('jb three tax', j5.tax, 15168000); eq('jb three nong', j5.nong, 3033600);
eq('jb below line', C.jongbu({ prices: [1100000000], oneHouse: true }).tax, 0);
var j6 = C.jongbu({ prices: [1000000000, 800000000], prevTotal: 3000000 });
eq('jb burden cap tax', j6.tax, 1440000); eq('jb burden cap cut', j6.capCut, 444000);
eq('jb prop 5억 다주택', C.housePropertyTax(500000000, false).tax, 570000);
eq('jb prop 5억 1주택', C.housePropertyTax(500000000, true).tax, 0.0005 * 6e7 + 0.001 * 9e7 + 0.002 * 7e7);

// 고향사랑기부금 — 손계산 (고향사랑e음 예시: 10만원 → 소득세 90,909원 + 지방소득세 9,090원)
var h1 = C.hometownCredit({ amount: 100000 }); eq('ht 10만 national', h1.national, 90909); eq('ht 10만 local', h1.local, 9090);
eq('ht 10만 credit', h1.credit, 99999); eq('ht 10만 gift', h1.gift, 30000); eq('ht 10만 net', h1.net, -29999);
var h2 = C.hometownCredit({ amount: 200000 }); eq('ht 20만 national', h2.national, 130909); eq('ht 20만 credit', h2.credit, 143999);
var h3 = C.hometownCredit({ amount: 500000 }); eq('ht 50만 national', h3.national, 175909); eq('ht 50만 local', h3.local, 17590); eq('ht 50만 credit', h3.credit, 193499);
var h4 = C.hometownCredit({ amount: 1000000, disaster: true }); eq('ht disaster 100만 national', h4.national, 370909); eq('ht disaster 100만 credit', h4.credit, 407999);
var h5 = C.hometownCredit({ amount: 25000000 }); eq('ht over cap used', h5.used, 20000000); eq('ht over', h5.over, 5000000);
eq('ht 2000만 national', h5.national, 3100909); eq('ht 2000만 credit', h5.credit, 3410999); eq('ht 2000만 gift', h5.gift, 6000000);
var h6 = C.hometownCredit({ amount: 300000, taxCap: 50000 }); eq('ht taxcap capped', h6.capped, true); eq('ht taxcap national', h6.national, 50000); eq('ht taxcap credit', h6.credit, 55000);
var h7 = C.hometownCredit({ amount: 50000 }); eq('ht 5만 national', h7.national, 45454); eq('ht 5만 credit', h7.credit, 49999);
eq('ht 0', C.hometownCredit({ amount: 0 }).credit, 0);

// 카드 공제 연말 계획 — 손계산 (조특법 제126조의2)
// A: 총급여 4천만, 신용 1,500만 → 최저 1,000만, 공제 (1500−1000)×15% = 75만, 한도 300만까지 225만 남음
var cpA = C.cardPlan({ gross: 4e7, credit: 1.5e7 });
eq('cp A now', cpA.now.deduction, 750000); eq('cp A room', cpA.room, 2250000); eq('cp A toMin', cpA.toMin, 0);
eq('cp A needDebit', cpA.needDebit, 7500000, 1); eq('cp A needCredit', cpA.needCredit, 15000000, 1);
// B: 총급여 6천만, 신용 1,000만·체크 200만 → 최저 1,500만에 300만 모자람, 공제 0
var cpB = C.cardPlan({ gross: 6e7, credit: 1e7, debit: 2e6, plan: 1e7 });
eq('cp B now', cpB.now.deduction, 0); eq('cp B toMin', cpB.toMin, 3000000);
eq('cp B needDebit', cpB.needDebit, 13000000, 1); eq('cp B needCredit', cpB.needCredit, 21000000, 1);
// 남은 1,000만원: 체크면 0.3×1000만 − 90만 = 210만, 신용이면 0.15×1000만 − 15만 = 135만
eq('cp B ifDebit', cpB.ifDebit.deduction, 2100000); eq('cp B ifCredit', cpB.ifCredit.deduction, 1350000);
var cpB5 = C.cardPlan({ gross: 6e7, credit: 1e7, debit: 2e6, plan: 5e6 });
eq('cp B 500 same', cpB5.ifDebit.deduction - cpB5.ifCredit.deduction, 0);
// C: 이미 한도 초과(총급여 8천만, 자녀 2, 신용 5천만, 전통시장 300만) → 420만, 더 쓸 필요 없음
var cpC = C.cardPlan({ gross: 8e7, kids: 2, credit: 5e7, market: 3e6 });
eq('cp C now', cpC.now.deduction, 4200000); eq('cp C room', cpC.room, 0); eq('cp C needDebit', cpC.needDebit, 0);
// D: 총급여 3천만, 체크 900만·대중교통 100만 → 최저 750만, 270+40−225 = 85만
var cpD = C.cardPlan({ gross: 3e7, debit: 9e6, transit: 1e6 });
eq('cp D now', cpD.now.deduction, 850000); eq('cp D needDebit', cpD.needDebit, 7166667, 1);
eq('saving 15%', C.deductionSaving(1000000, 0.15), 165000); eq('saving 24%', C.deductionSaving(750000, 0.24), 198000);

// 의료비 세액공제 상세 — 손계산 (소득세법 제59조의4②)
// 1: 총급여 5천만(3% = 150만), 일반 300만 → 150만 × 15% = 22만 5천, 지방 2만 2,500
var m1 = C.medicalDetail({ gross: 5e7, general: 3e6 });
eq('med1 floor', m1.floor, 1500000); eq('med1 national', m1.national, 225000); eq('med1 refund', m1.refund, 247500);
// 2: 일반 100만이 문턱에 50만 모자람 → 본인 200만에서 50만 빼고 150만 × 15%, 기존 medicalCredit과 같아야 함
var m2 = C.medicalDetail({ gross: 5e7, general: 1e6, special: 2e6 });
eq('med2 t2', m2.t2, 1500000); eq('med2 national', m2.national, 225000); eq('med2 = old', m2.credit, C.medicalCredit(5e7, 1e6, 2e6));
// 3: 총급여 4천만(120만), 난임시술 500만만 → (500 − 120) × 30% = 114만
var m3 = C.medicalDetail({ gross: 4e7, ivf: 5e6 });
eq('med3 t4', m3.t4, 3800000); eq('med3 national', m3.national, 1140000);
// 4: 총급여 1억(300만), 일반 1,500만 → 1,200만이지만 700만 한도 → 105만, 한도 넘은 500만
var m4 = C.medicalDetail({ gross: 1e8, general: 1.5e7 });
eq('med4 t1', m4.t1, 7000000); eq('med4 national', m4.national, 1050000); eq('med4 overCap', m4.overCap, 5000000);
// 5: 총급여 3천만(90만), 일반 50·특정 20·미숙아 300 → 모자란 40만을 특정 20, 미숙아 20 순으로 빼고 280만 × 20% = 56만
var m5 = C.medicalDetail({ gross: 3e7, general: 5e5, special: 2e5, preemie: 3e6 });
eq('med5 t2', m5.t2, 0); eq('med5 t3', m5.t3, 2800000); eq('med5 national', m5.national, 560000);
// 6: 문턱 미달 → 공제 0, 남은 금액 / 세액 상한
var m6 = C.medicalDetail({ gross: 5e7, general: 1e6 });
eq('med6 national', m6.national, 0); eq('med6 toFloor', m6.toFloor, 500000);
var m7 = C.medicalDetail({ gross: 5e7, general: 3e6, taxCap: 100000 });
eq('med7 capped', m7.capped, true); eq('med7 national', m7.national, 100000); eq('med7 local', m7.local, 10000);
// 7: 맞벌이 — 나 6천만·본인 100만, 배우자 2천만·본인 100만
// 모두 나: 특정 100 + 일반(배우자) 100, 문턱 180 → 20만 × 15% = 3만(+지방 3천) / 모두 배우자: 일반 100 − 60 = 40 + 특정 100 = 140 × 15% = 21만(+2.1만)
// 각자: 나 0, 배우자 (100 − 60) × 15% = 6만(+6천)
var mc = C.medicalCouple({ me: { gross: 6e7, self: 1e6 }, sp: { gross: 2e7, self: 1e6 } });
eq('mc allMe', mc.allMe.refund, 33000); eq('mc allSp', mc.allSp.refund, 231000); eq('mc split', mc.split.refund, 66000); eq('mc best', mc.best, 'sp');
// 배우자 결정세액이 5만원뿐이면 몰아줘도 5만 5천만 돌려받음 → 나에게 모으는 쪽(3만 3천)보다 여전히 큼
var mc2 = C.medicalCouple({ me: { gross: 6e7, self: 1e6 }, sp: { gross: 2e7, self: 1e6, taxCap: 50000 } });
eq('mc2 allSp', mc2.allSp.refund, 55000); eq('mc2 best', mc2.best, 'sp');

// 월세 세액공제 (조특법 제95조의2, 2026년 지급분)
// 1: 총급여 5천만 → 근로소득금액 5,000 − (1,200 + 500×5%) = 3,775만 ≤ 4,500만 → 17%. 600만 × 17% = 102만, 지방 10.2만, 표준공제 14.3만 포기
var r1 = C.rentCredit({ gross: 5e7, rent: 6e6 });
eq('rent1 rate', r1.rate, 0.17); eq('rent1 national', r1.national, 1020000); eq('rent1 refund', r1.refund, 1122000); eq('rent1 gain', r1.gain, 979000);
// 2: 같은 사람에 다른 종합소득 1천만 → 4,775만 > 4,500만 → 15%
eq('rent2 national', C.rentCredit({ gross: 5e7, other: 1e7, rent: 6e6 }).national, 900000);
// 3: 총급여 7천만, 월세 1,200만 → 1천만 한도 × 15% = 150만, 초과 200만
var r3 = C.rentCredit({ gross: 7e7, rent: 1.2e7 });
eq('rent3 national', r3.national, 1500000); eq('rent3 over', r3.overCap, 2000000);
// 4: 총급여 8,100만 → 대상 아님 / 총급여 7천만 + 다른 소득 1,500만 → 5,675 + 1,500 = 7,175만 > 7천만 → 대상 아님
eq('rent4 gross over', C.rentCredit({ gross: 8.1e7, rent: 6e6 }).national, 0);
eq('rent4 income over', C.rentCredit({ gross: 7e7, other: 1.5e7, rent: 6e6 }).national, 0);
// 5: 결정세액 50만원이면 50만원까지만
var r5 = C.rentCredit({ gross: 5e7, rent: 6e6, taxCap: 500000 });
eq('rent5 capped', r5.capped, true); eq('rent5 national', r5.national, 500000); eq('rent5 local', r5.local, 50000);
// 6: 배우자 추가 공제 — 세대주 700만(5천만, 17%) + 배우자 500만(4천만 → 근로소득금액 2,875만, 17%) → 합계 1,200만, 초과 200만을 배우자 몫에서 빼 300만
var rc = C.rentCouple({ head: { gross: 5e7, rent: 7e6 }, sp: { gross: 4e7, rent: 5e6 } });
eq('rentC spBase', rc.spBase, 3000000); eq('rentC head', rc.head.refund, 1309000); eq('rentC sp', rc.sp.refund, 561000); eq('rentC total', rc.refund, 1870000);
// 7: 시행령 제95조③ 일할 계산. 2025-03-01~2027-02-28 월 50만 → 24개월 1,200만 ÷ 730일 × 2026년 365일 = 600만
var ry = C.rentYearAmount({ start: D('2025-03-01'), end: D('2027-02-28'), monthly: 500000 }, 2026);
eq('rentY months', ry.months, 24); eq('rentY days', ry.contractDays, 730); eq('rentY amount', ry.amount, 6000000); eq('rentY even', ry.even, true);
// 8: 2026-07-01 입주, 2028-06-30까지 월 60만 → 1,440만 ÷ 731일(2028년 윤일) × 184일 = 3,624,623
var ry2 = C.rentYearAmount({ start: D('2026-07-01'), end: D('2028-06-30'), monthly: 600000 }, 2026);
eq('rentY2 days', ry2.days, 184); eq('rentY2 contractDays', ry2.contractDays, 731); eq('rentY2 amount', ry2.amount, 3624623);
// 9: 같은 계약(7번)에서 2026-06-30에 이사 → 181일, 1,200만 ÷ 730 × 181 = 2,975,342
eq('rentY3 amount', C.rentYearAmount({ start: D('2025-03-01'), end: D('2027-02-28'), monthly: 500000, moveOut: D('2026-06-30') }, 2026).amount, 2975342);


// 교육비 세액공제 — 손계산 (소득세법 제59조의4③, 시행령 제118조의6)
// 1: 초등 2학년 방과후 50만 + 체험학습 40만(30만 한도) + 예능학원 300만 = 380만 → 300만 한도 → 45만, 지방 4만 5천
var e1 = C.eduCredit({ people: [{ kind: 'elem', lowGrade: true, tuition: 5e5, trip: 4e5, arts: 3e6 }] });
eq('edu1 sum', e1.persons[0].sum, 3800000); eq('edu1 base', e1.base, 3000000); eq('edu1 national', e1.national, 450000); eq('edu1 refund', e1.refund, 495000);
// 2: 고등학생 수업료 등 100만 + 교복 60만(50만 한도) + 체험학습 20만 = 170만 → 25만 5천
var e2 = C.eduCredit({ people: [{ kind: 'high', tuition: 1e6, uniform: 6e5, trip: 2e5 }] });
eq('edu2 base', e2.base, 1700000); eq('edu2 cutUniform', e2.persons[0].cutUniform, 100000); eq('edu2 national', e2.national, 255000);
// 3: 대학생 등록금 1,000만 → 900만 한도 → 135만 / 본인 대학원 1,200만 → 한도 없음 → 180만
eq('edu3 univ', C.eduCredit({ people: [{ kind: 'univ', tuition: 1e7 }] }).national, 1350000);
eq('edu3 self', C.eduCredit({ people: [{ kind: 'self', tuition: 1.2e7 }] }).national, 1800000);
// 4: 초등 4학년(3학년 이상, 9세 이상) 예능학원 200만은 공제 안 됨 → 0, 중학생은 예능학원 칸 무시
var e4 = C.eduCredit({ people: [{ kind: 'elem', lowGrade: false, arts: 2e6 }, { kind: 'mid', arts: 1e6 }] });
eq('edu4 national', e4.national, 0); eq('edu4 cutArts', e4.persons[0].cutArts, 2000000);
// 5: 취학 전 400만(300만 한도) + 위 고등학생 170만 = 470만 → 70만 5천, 지방 7만 500
var e5 = C.eduCredit({ people: [{ kind: 'pre', tuition: 4e6 }, { kind: 'high', tuition: 1e6, uniform: 6e5, trip: 2e5 }] });
eq('edu5 national', e5.national, 705000); eq('edu5 local', e5.local, 70500);
// 6: 결정세액 50만에서 막힘 (대학생 900만 → 135만이지만 50만까지만)
var e6 = C.eduCredit({ people: [{ kind: 'univ', tuition: 9e6 }], taxCap: 500000 });
eq('edu6 capped', e6.capped, true); eq('edu6 national', e6.national, 500000); eq('edu6 refund', e6.refund, 550000);
// 7: 장애인 특수교육비 1,000만 한도 없음 → 150만
eq('edu7 disabled', C.eduCredit({ people: [{ kind: 'disabled', tuition: 1e7 }] }).national, 1500000);

// 기부금 세액공제 (2026-11-20, 손으로 계산)
// 1: 총급여 5,000만 → 근로소득공제 1,225만 → 소득금액 3,775만. 일반 120만 → 한도 1,132.5만 안 → 18만, 지방 1만 8천
var dn1 = C.donationCredit({ gross: 5e7, general: 1200000 });
eq('don1 income', dn1.income, 37750000); eq('don1 national', dn1.national, 180000); eq('don1 local', dn1.local, 18000);
eq('don1 next10', dn1.next10, 16500);
// 2: 정치자금 10만 → 90,909 / 30만 → 90,909.09 + 30,000 = 120,909
eq('don2 pol10', C.donationCredit({ gross: 5e7, political: 100000 }).national, 90909);
eq('don2 pol30', C.donationCredit({ gross: 5e7, political: 300000 }).national, 120909);
// 3: 총급여 3,000만 → 공제 975만 → 소득금액 2,025만. 종교단체만 300만 → 한도 202.5만, 97.5만 이월 → 303,750
var dn3 = C.donationCredit({ gross: 3e7, religious: 3e6 });
eq('don3 relUsed', dn3.relUsed, 2025000); eq('don3 relOver', dn3.relOver, 975000); eq('don3 national', dn3.national, 303750);
// 4: 같은 소득에 종교 300만 + 종교 외 100만 → 한도 202.5만 + min(405만, 100만) = 302.5만 → 453,750
var dn4 = C.donationCredit({ gross: 3e7, religious: 3e6, general: 1e6 });
eq('don4 genUsed', dn4.genUsed, 1000000); eq('don4 relUsed', dn4.relUsed, 2025000); eq('don4 national', dn4.national, 453750);
// 5: 총급여 1억 → 소득금액 8,525만. 일반 1,500만 → 1,000만×15% + 500만×30% = 300만, 지방 30만
var dn5 = C.donationCredit({ gross: 1e8, general: 1.5e7 });
eq('don5 national', dn5.national, 3000000); eq('don5 refund', dn5.refund, 3300000); eq('don5 next10', dn5.next10, 33000);
// 6: 특례 500만 + 일반 700만 = 1,200만 → 150만 + 60만 = 210만
eq('don6 national', C.donationCredit({ gross: 1e8, special: 5e6, general: 7e6 }).national, 2100000);
// 7: 결정세액 100만에서 막힘: 일반 1,000만(150만) → 100만만, 50만 이월
var dn7 = C.donationCredit({ gross: 5e7, general: 1e7, taxCap: 1000000, otherSpecial: true });
eq('don7 capped', dn7.capped, true); eq('don7 donNat', dn7.donNat, 1000000); eq('don7 donLost', dn7.donLost, 500000);
// 8: 정치자금이 먼저: 정치 10만 + 일반 100만, 결정세액 10만 → 정치 90,909 + 일반 9,091
var dn8 = C.donationCredit({ gross: 5e7, political: 100000, general: 1e6, taxCap: 100000, otherSpecial: true });
eq('don8 polNat', dn8.polNat, 90909); eq('don8 donNat', dn8.donNat, 9091);
// 9: 일반 50만뿐이고 다른 특별공제 없음 → 7만 5천 < 표준세액공제 13만 → 표준이 유리
var dn9 = C.donationCredit({ gross: 5e7, general: 500000 });
eq('don9 standardLost', dn9.standardLost, 130000); eq('don9 betterStandard', dn9.betterStandard, true);
// 10: 정치자금만이면 표준세액공제와 같이 받음
eq('don10 pol standard', C.donationCredit({ gross: 5e7, political: 100000 }).standardLost, 0);

// 주택자금 소득공제 (조특법 제87조②⑤, 소득세법 제52조④⑤⑥, 2026년 귀속)
// 1: 총급여 5천만 무주택 세대주, 청약 240만·전세대출 원리금 600만·주담대 이자 900만(15년 이상 고정+비거치)
//    청약 96만 + 임차 240만 = 336만(≤400만), 이자 900만 → 1,236만 ≤ 한도 2천만. 근로소득금액 3,775만 안
var hd1 = C.housingDeduction({ gross: 5e7, status: 'head', deposit: 2.4e6, rentRepay: 6e6, interest: 9e6, loanType: 'fixedAmort15' });
eq('hd1 sub', hd1.sub, 960000); eq('hd1 rent', hd1.rent, 2400000); eq('hd1 mort', hd1.mort, 9000000); eq('hd1 total', hd1.total, 12360000); eq('hd1 earned', hd1.earned, 37750000);
// 2: 청약 300만(120만) + 임차 1천만(400만) = 520만 → 400만 한도, 초과 120만. 주담대 없음
var hd2 = C.housingDeduction({ gross: 6e7, status: 'head', deposit: 3e6, rentRepay: 1e7 });
eq('hd2 subRent', hd2.subRent, 4000000); eq('hd2 over', hd2.subRentOver, 1200000); eq('hd2 total', hd2.total, 4000000);
// 3: 총급여 8천만이면 청약 공제 없음. 10년 이상 15년 미만 고정금리 이자 700만 → 한도 600만
var hd3 = C.housingDeduction({ gross: 8e7, status: 'head', deposit: 3e6, interest: 7e6, loanType: 'either10' });
eq('hd3 subOk', hd3.subOk, false); eq('hd3 sub', hd3.sub, 0); eq('hd3 cap', hd3.cap, 6000000); eq('hd3 total', hd3.total, 6000000); eq('hd3 capOver', hd3.capOver, 1000000);
// 4: 1주택 세대주는 주담대 이자만. 1,900만 → 15년 이상 고정 또는 비거치 1,800만 한도
var hd4 = C.housingDeduction({ gross: 5e7, status: 'oneHouse', deposit: 3e6, rentRepay: 5e6, interest: 1.9e7, loanType: 'either15' });
eq('hd4 sub', hd4.sub, 0); eq('hd4 rent', hd4.rent, 0); eq('hd4 total', hd4.total, 18000000);
// 5: 세대원(세대주가 안 받음): 청약 불가, 개인 차입 원리금 300만(총급여 4천만 ≤ 5천만) 120만 + 이자 500만(15년 이상 그 밖, 800만) = 620만. 실거주 아니면 이자 빠짐
var hd5 = C.housingDeduction({ gross: 4e7, status: 'member', deposit: 3e6, rentRepay: 3e6, rentPrivate: true, interest: 5e6, loanType: 'other15' });
eq('hd5 sub', hd5.sub, 0); eq('hd5 rent', hd5.rent, 1200000); eq('hd5 total', hd5.total, 6200000);
eq('hd5 noLiveIn', C.housingDeduction({ gross: 4e7, status: 'member', rentRepay: 3e6, rentPrivate: true, interest: 5e6, loanType: 'other15', liveIn: false }).total, 1200000);
eq('hd5 private over', C.housingDeduction({ gross: 5.5e7, status: 'head', rentRepay: 3e6, rentPrivate: true }).rent, 0);
// 6: 총급여 600만 → 근로소득금액 600 − 390 = 210만. 이자 500만이라도 210만까지만 (제52조⑧)
var hd6 = C.housingDeduction({ gross: 6e6, status: 'head', interest: 5e6, loanType: 'fixedAmort15' });
eq('hd6 earned', hd6.earned, 2100000); eq('hd6 total', hd6.total, 2100000); eq('hd6 incomeCapped', hd6.incomeCapped, true);
// 7: 청약 100만 넣은 사람이 200만 더 넣으면 공제 40만 → 120만, +80만. 임차 원리금 1천만이 있으면 이미 400만 한도라 +0
var hr1 = C.housingSubRoom({ gross: 5e7, status: 'head', deposit: 1e6 });
eq('hr1 more', hr1.more, 2000000); eq('hr1 gain', hr1.gain, 800000);
eq('hr2 gain', C.housingSubRoom({ gross: 5e7, status: 'head', deposit: 1e6, rentRepay: 1e7 }).gain, 0);
// 8: 2주택 이상 세대는 모두 0
eq('hd8 multi', C.housingDeduction({ gross: 5e7, status: 'multi', deposit: 3e6, rentRepay: 5e6, interest: 1e7, loanType: 'fixedAmort15' }).total, 0);

// 해외주식 양도소득세 (소득세법 제94조①3호다목·제102조·제103조·제104조①12호, 지방세법 제103조의3①12호, 조특법 제91조의26)
// 1: 10주, $100→$150, 환율 1,300→1,400, 수수료 0.25%: 양도가액 2,100,000 − 취득가액 1,300,000 − 수수료 (2,100,000+1,300,000)×0.25% = 8,500 → 791,500
//    주가 효과 10×50×1,300 = 650,000, 환율 효과 10×150×100 = 150,000 (합 800,000 = 양도가액 − 취득가액)
var ft1 = C.foreignTrade({ qty: 10, buyPrice: 100, sellPrice: 150, buyRate: 1300, sellRate: 1400, feePct: 0.25 });
eq('ft1 proceeds', ft1.proceeds, 2100000); eq('ft1 cost', ft1.cost, 1300000); eq('ft1 fees', ft1.fees, 8500); eq('ft1 gain', ft1.gain, 791500);
eq('ft1 priceGain', ft1.priceGain, 650000); eq('ft1 fxGain', ft1.fxGain, 150000);
// 2: 10주 $200→$300, 1,350→1,400, 0.25%: 4,200,000 − 2,700,000 − 17,250 = 1,482,750 (250만원 안이라 세금 0)
eq('ft2 gain', C.foreignTrade({ qty: 10, buyPrice: 200, sellPrice: 300, buyRate: 1350, sellRate: 1400, feePct: 0.25 }).gain, 1482750);
eq('ft2 tax', C.foreignStockTax({ gain: 1482750 }).tax, 0);
// 3: 차익 800만 → 과세표준 550만 → 110만 + 지방 11만 = 121만. 손실 550만 실현하면 0
var fs1 = C.foreignStockTax({ gain: 8e6 });
eq('fs1 base', fs1.base, 5500000); eq('fs1 national', fs1.national, 1100000); eq('fs1 local', fs1.local, 110000); eq('fs1 tax', fs1.tax, 1210000);
eq('fs1 room', fs1.room, 0); eq('fs1 lossToZero', fs1.lossToZero, 5500000); eq('fs1 noFile', fs1.noFilePenalty, 220000); eq('fs1 late30', fs1.latePenalty30, 7260);
// 4: 이익 1,000만 − 손실 300만 = 700만 → 450만 × 22% = 99만
eq('fs2 tax', C.foreignStockTax({ gain: 1e7, loss: 3e6 }).tax, 990000);
// 5: 국세청 안내 사례: 국내주식 손실 400만 + 해외주식 이익 300만 = −100만 → 세금 0, 250만원 공제 여유 그대로
var fs3 = C.foreignStockTax({ gain: 3e6, domestic: -4e6 });
eq('fs3 total', fs3.total, -1000000); eq('fs3 tax', fs3.tax, 0); eq('fs3 room', fs3.room, 2500000);
// 6: 차익 200만 → 공제 안에서 50만 더 실현 가능
eq('fs4 room', C.foreignStockTax({ gain: 2e6 }).room, 500000);
// 7: 국내시장복귀계좌(8~12월 50%): 차익 600만 중 RIA 400만 → 기본공제 뒤 350만, RIA 공제 200만 → 150만 × 22% = 33만. RIA 400만뿐이면 공제가 150만에서 막혀 0
var fs5 = C.foreignStockTax({ gain: 6e6, riaGain: 4e6 });
eq('fs5 base0', fs5.base0, 3500000); eq('fs5 riaDed', fs5.riaDed, 2000000); eq('fs5 national', fs5.national, 300000); eq('fs5 local', fs5.local, 30000);
eq('fs5b riaDed', C.foreignStockTax({ gain: 4e6, riaGain: 4e6 }).riaDed, 1500000); eq('fs5b tax', C.foreignStockTax({ gain: 4e6, riaGain: 4e6 }).tax, 0);
// 8: 분납(시행령 제175조): 차익 6,000만 → 산출세액 1,150만 → 1천만 초과분 150만. 1억 3천만 → 2,550만 → 50%인 1,275만. 3,000만 → 550만은 분납 없음
var fs6 = C.foreignStockTax({ gain: 6e7 });
eq('fs6 split', fs6.split, true); eq('fs6 splitAmount', fs6.splitAmount, 1500000);
eq('fs6b splitAmount', C.foreignStockTax({ gain: 1.3e8 }).splitAmount, 12750000);
eq('fs6c split', C.foreignStockTax({ gain: 3e7 }).split, false);
// 9: 10원 미만 버림: 과세표준 1,234,567 → 246,913.4 → 246,910 / 24,691.3 → 24,690
var fs7 = C.foreignStockTax({ gain: 3734567 });
eq('fs7 national', fs7.national, 246910); eq('fs7 local', fs7.local, 24690);
// 10: 중소기업 주식 10%: 800만 → 550만 × 10% = 55만 + 5.5만
eq('fs8 sme', C.foreignStockTax({ gain: 8e6, sme: true }).tax, 605000);
// 11: 연말 전략: 이익 1,000만·손실 300만에 평가손실 600만 → 450만만 손절하면 세금 99만 → 0
var fp1 = C.foreignStockPlan({ gain: 1e7, loss: 3e6, unrealLoss: 6e6 });
eq('fp1 sellLoss', fp1.sellLoss, 4500000); eq('fp1 save', fp1.saveByLoss, 990000); eq('fp1 after', fp1.afterLoss.tax, 0);
//     이익 100만에 평가이익 200만 → 150만까지 익절해도 세금 0, 전부 팔면 300만 → 50만 × 22% = 11만
var fp2 = C.foreignStockPlan({ gain: 1e6, unrealGain: 2e6 });
eq('fp2 sellGain', fp2.sellGain, 1500000); eq('fp2 afterAll', fp2.afterAll.tax, 110000); eq('fp2 per100', fp2.per100, 220000);

// ---------- 증여세 (손계산) ----------
// 성년 자녀 1억: 1억 − 5천 = 5천 × 10% = 500만, 신고공제 15만, 납부 485만
var g1 = C.giftTax({ amount: 1e8, relation: 'parent' });
eq('g1 base', g1.base, 5e7); eq('g1 calc', g1.calc, 5e6); eq('g1 report', g1.reportCredit, 150000); eq('g1 pay', g1.payable, 4850000);
// 미성년 3천: 공제 2천 → 1천 × 10% = 100만 − 3만 = 97만
eq('g2 pay', C.giftTax({ amount: 3e7, relation: 'parent', minor: true }).payable, 970000);
// 배우자 7억: 7억 − 6억 = 1억 → 1천만 − 30만 = 970만
eq('g3 pay', C.giftTax({ amount: 7e8, relation: 'spouse' }).payable, 9700000);
// 혼인 공제: 1.5억 = 5천 + 1억 → 세금 0
var g4 = C.giftTax({ amount: 1.5e8, relation: 'parent', marriage: true });
eq('g4 marriage', g4.marriageDed, 1e8); eq('g4 pay', g4.payable, 0); eq('g4 room', g4.room, 0);
// 5억: 4.5억 × 20% − 1천만 = 8천만, 3% 240만, 납부 7,760만, 분납 절반 3,880만
var g5 = C.giftTax({ amount: 5e8, relation: 'parent' });
eq('g5 calc', g5.calc, 8e7); eq('g5 pay', g5.payable, 77600000); eq('g5 split', g5.splitAmount, 38800000); eq('g5 inst', g5.installment, true);
// 성년 손주 1억: 500만 + 할증 150만 = 650만, 3% 19.5만, 납부 630.5만
var g6 = C.giftTax({ amount: 1e8, relation: 'grandparent' });
eq('g6 sur', g6.surcharge, 1500000); eq('g6 pay', g6.payable, 6305000);
// 자녀 사망으로 손주가 받으면 할증 없음
eq('g6b sur', C.giftTax({ amount: 1e8, relation: 'grandparentDeceased' }).surcharge, 0);
// 미성년 손주 30억: 29.8억 × 40% − 1.6억 = 10.32억, 할증 40% 4.128억, 합계 14.448억, 3% 43,344,000, 납부 1,401,456,000
var g7 = C.giftTax({ amount: 3e9, relation: 'grandparent', minor: true });
eq('g7 calc', g7.calc, 1032000000); eq('g7 sur', g7.surcharge, 412800000); eq('g7 pay', g7.payable, 1401456000);
// 10년 합산: 전에 5천(세금 0) + 이번 5천 → 1억 − 5천 = 5천 → 500만 − 15만 = 485만
eq('g8 pay', C.giftTax({ amount: 5e7, relation: 'parent', prior: 5e7 }).payable, 4850000);
// 전에 1억(산출 500만) + 이번 1억: 2억 − 5천 = 1.5억 → 2천만, 납부세액공제 한도 2천만 × 5천/1.5억 = 666만 → 500만, (2천만 − 500만) × 97% = 1,455만, 분납 455만
var g9 = C.giftTax({ amount: 1e8, relation: 'parent', prior: 1e8, priorTax: 5e6 });
eq('g9 calc', g9.calc, 2e7); eq('g9 credit', g9.priorCredit, 5e6); eq('g9 pay', g9.payable, 14550000); eq('g9 split', g9.splitAmount, 4550000);
// 과세최저한: 기타친족 1,040만 → 과세표준 40만 → 0 / 1,050만 → 50만 × 10% = 5만 − 1,500 = 48,500
eq('g10 pay', C.giftTax({ amount: 10400000, relation: 'relative' }).payable, 0);
eq('g10b pay', C.giftTax({ amount: 10500000, relation: 'relative' }).payable, 48500);
// 부담부증여: 3억 − 채무 1억 = 2억 − 5천 = 1.5억 → 2천만
eq('g11 calc', C.giftTax({ amount: 3e8, debt: 1e8, relation: 'parent' }).calc, 2e7);
// 타인 1천만: 공제 없음 → 100만
eq('g12 calc', C.giftTax({ amount: 1e7, relation: 'other' }).calc, 1e6);
// 1천만원 미만 과거 증여는 합산 안 하지만 공제는 소진: 900만 + 이번 5천 → 공제 4,100만 → 900만 × 10% = 90만
var g13 = C.giftTax({ amount: 5e7, relation: 'parent', prior: 9e6 });
eq('g13 added', g13.added, 0); eq('g13 ded', g13.deduction, 41000000); eq('g13 calc', g13.calc, 900000);
// 공제 안에서 더 받을 수 있는 금액: 3천만 → 2천만 남음
eq('g14 room', C.giftTax({ amount: 3e7, relation: 'parent' }).room, 2e7);
// 신고기한
var gd = C.giftDeadline(new Date(2026, 10, 30)); eq('gd m', gd.getMonth(), 1); eq('gd d', gd.getDate(), 28); eq('gd y', gd.getFullYear(), 2027);
var gd2 = C.giftDeadline(new Date(2026, 11, 15)); eq('gd2 m', gd2.getMonth(), 2); eq('gd2 d', gd2.getDate(), 31);

// 부가가치세 — 간이: 음식점 6천만 × 15% × 10% = 90만, 매입 2천만 × 0.5% = 10만, 카드 4천만 × 1.3% = 52만, 전자신고 5천 → 275,000
var v1 = C.simpleVat({ sales: 6e7, sector: 'retail', purchases: 2e7, card: 4e7, consumer: true, eFile: true });
eq('v1 base', v1.base, 900000); eq('v1 pc', v1.purchaseCredit, 100000); eq('v1 card', v1.cardFull, 520000); eq('v1 tax', v1.tax, 275000);
eq('v1 exempt', v1.exempt, false); eq('v1 over', v1.overExempt, 12000000);
// 같은 숫자를 일반과세로: 60,000,000 × 10/110 = 5,454,545 − 1,818,181 = 3,636,364 − 카드 520,000 = 3,116,364
eq('v1 general', v1.generalTax, 3116364);
// 4,500만 → 납부의무 면제 (계산상 세액 675,000 − 카드 585,000 = 90,000 − 5천 = 85,000이지만 0)
var v2 = C.simpleVat({ sales: 4.5e7, sector: 'retail', card: 4.5e7, consumer: true, eFile: true, prepaid: 300000 });
eq('v2 exempt', v2.exempt, true); eq('v2 tax', v2.tax, 0); eq('v2 would', v2.exemptTax, 85000); eq('v2 due', v2.due, -300000);
// 공제가 납부세액을 넘으면 납부세액까지만: 소매 5천만 × 15% × 10% = 75만, 매입 15만 + 카드 65만 = 80만 → 75만까지, 전자신고 공제 0
var v3 = C.simpleVat({ sales: 5e7, sector: 'retail', purchases: 3e7, card: 5e7, consumer: true, eFile: true });
eq('v3 base', v3.base, 750000); eq('v3 credits', v3.credits, 750000); eq('v3 lost', v3.lost, 50000); eq('v3 efile', v3.eFile, 0); eq('v3 tax', v3.tax, 0);
// 소비자 업종이 아니고 직전 연도 4,800만 이상인 간이(제조 20%)는 카드 공제 없음; 직전 4,800만 미만이면 있음
var v4 = C.simpleVat({ sales: 8e7, sector: 'manufacture', card: 1e7, prevSales: 6e7 });
eq('v4 base', v4.base, 1600000); eq('v4 card', v4.cardFull, 0); eq('v4 tax', v4.tax, 1600000);
eq('v4b card', C.simpleVat({ sales: 8e7, sector: 'manufacture', card: 1e7, prevSales: 4e7 }).cardFull, 130000);
// 1억 400만 이상이면 다음 해 7월부터 일반과세
eq('v5 general', C.simpleVat({ sales: 1.1e8, sector: 'retail' }).becomesGeneral, true);
eq('v5b general', C.simpleVat({ sales: 103999999, sector: 'retail' }).becomesGeneral, false);
// 일반: 매출 1억 → 1천만, 매입 6천만 → 600만, 카드 5,500만 × 1.3% = 715,000, 전자신고 5천, 예정고지 150만 → 1,780,000
var g1v = C.generalVat({ supply: 1e8, purchases: 6e7, card: 5.5e7, cardOk: true, eFile: true, prepaid: 1500000 });
eq('gv1 net', g1v.net, 4000000); eq('gv1 card', g1v.cardCredit, 715000); eq('gv1 result', g1v.result, 1780000);
// 일반 환급: 매출세액 100만 − 매입세액 300만 = −200만, 카드 공제는 0, 전자신고 5천 더해 2,005,000 환급
var g2v = C.generalVat({ supply: 1e7, purchases: 3e7, card: 1e7, cardOk: true, eFile: true });
eq('gv2 card', g2v.cardCredit, 0); eq('gv2 refund', g2v.refund, 2005000);
// 카드 공제 연 1천만원 한도: 9억 × 1.3% = 1,170만, 1기에 300만 받았으면 700만까지
eq('gv3 card', C.generalVat({ supply: 9e8, card: 9e8, cardOk: true }).cardCredit, 10000000);
eq('gv3b card', C.generalVat({ supply: 9e8, card: 9e8, cardOk: true, cardUsed: 3e6 }).cardCredit, 7000000);
// 2027년부터 1%·500만원
eq('gv4 card', C.generalVat({ supply: 1e8, card: 1e8, cardOk: true, year: 2027 }).cardCredit, 1000000);
eq('gv4b cap', C.vatCardRule(2027).cap, 5000000);
// 신고기한: 2027-01-25(월), 2032-01-25(일) → 26일
var vd = C.vatDeadline(2026); eq('vd y', vd.getFullYear(), 2027); eq('vd d', vd.getDate(), 25); eq('vd w', vd.getDay(), 1);
eq('vd2 d', C.vatDeadline(2031).getDate(), 26);

// 연장·야간·휴일 근로수당 (근로기준법 제56조)
// 합계 방식: 시급 1만원, 연장 10h → 15만, 야간 4h 가산 → 2만, 휴일 1일 10h → 8h×1.5만 + 2h×2만 = 16만 → 33만, 가산분 13만
var om = C.overtimeMonth({ wage: 10000, ot: 10, night: 4, holDays: 1, holHours: 10 });
eq('om ot', om.otPay, 150000); eq('om night', om.nightPay, 20000); eq('om hol8', om.hol8Pay, 120000); eq('om holOver', om.holOverPay, 40000);
eq('om total', om.total, 330000); eq('om premium', om.premium, 130000);
// 상시 4명 이하: 가산 없이 일한 시간 × 시급만 (연장 10 + 휴일 10 = 20h × 1만), 야간 가산 0
var oms = C.overtimeMonth({ wage: 10000, ot: 10, night: 4, holDays: 1, holHours: 10, small: true });
eq('oms total', oms.total, 200000); eq('oms night', oms.nightPay, 0); eq('oms premium', oms.premium, 0);
// 출퇴근: 18:00~03:00, 휴게 60분(그중 야간 60분) → 근로 8h, 야간 22~03시 5h − 1h = 4h
var sh = C.shiftHours('18:00', '03:00', 60, 60); eq('sh work', sh.work, 8); eq('sh night', sh.night, 4);
var sh2 = C.shiftHours('09:00', '18:00', 60, 0); eq('sh2 work', sh2.work, 8); eq('sh2 night', sh2.night, 0);
var sh3 = C.shiftHours('22:00', '06:00', 0, 0); eq('sh3 work', sh3.work, 8); eq('sh3 night', sh3.night, 8);
var sh4 = C.shiftHours('04:00', '13:00', 60, 0); eq('sh4 night', sh4.night, 2); eq('sh4 work', sh4.work, 8);
eq('hm', C.hm('7:30'), 450);
// 하루: 시급 10,320원, 11시간(야간 1시간) 평일 → 8h 82,560 + 연장 3h×15,480 = 46,440 + 야간 가산 5,160 = 134,160
var od = C.overtimeDay({ wage: 10320, work: 11, night: 1 });
eq('od ot', od.ot, 3); eq('od otPrem', od.otPrem, 15480); eq('od nightPrem', od.nightPrem, 5160); eq('od total', od.total, 134160);
// 휴일 10시간 → 8h×15,480 = 123,840 + 2h×20,640 = 41,280 → 165,120
var oh = C.overtimeDay({ wage: 10320, work: 10, holiday: true });
eq('oh hol8', oh.hol8, 8); eq('oh holOver', oh.holOver, 2); eq('oh total', oh.total, 165120);
// 단시간근로자(1일 소정 5시간)가 7시간 → 2시간 초과근로 50% 가산(기간제법 제6조③): 72,240 + 10,320 = 82,560
eq('opt total', C.overtimeDay({ wage: 10320, work: 7, daily: 5, partTime: true }).total, 82560);
// 통상근로자 소정 5시간(법내 초과)·4명 이하 단시간은 가산 없음
eq('opt2 total', C.overtimeDay({ wage: 10320, work: 7, daily: 5 }).total, 72240);
eq('opt3 premium', C.overtimeDay({ wage: 10320, work: 7, daily: 5, partTime: true, small: true }).premium, 0);
// 월 통상임금 2,156,880원 ÷ 209시간 = 10,320원
eq('hourly', C.hourlyFromMonthly(2156880), 10320, 0.001);

if (typeof window.extraTests === 'function') window.extraTests(eq, C, D);
log((fails ? 'FAILED ' : 'OK ') + (total - fails) + '/' + total);
if (fails) { if (isNode) process.exit(1); else throw new Error('tests failed'); }
