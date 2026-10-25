# ABOUTME: Estimates UK contract take-home (inside IR35 umbrella vs outside via Ltd) and an employer's cost for a salaried hire.
# ABOUTME: Usage: python3 rate_maths.py --rates 700 800 --days 138 [--fte 80000 120000 --fraction 0.6]. 2026/27 rates; estimates only.
import argparse

PA, BASIC_TOP, HIGHER_TOP = 12570, 50270, 125140
EMPLOYER_NI, NI_THRESHOLD, LEVY = 0.15, 5000, 0.005
UMBRELLA_FEE_YEAR = 25 * 52


def income_tax(x: float) -> float:
    pa = PA if x <= 100000 else max(0, PA - (x - 100000) / 2)
    taxable, tax = max(0, x - pa), 0.0
    for width, rate in ((BASIC_TOP - PA, .2), (HIGHER_TOP - BASIC_TOP, .4), (1e12, .45)):
        part = min(taxable, width)
        tax += part * rate
        taxable -= part
    return tax


def employee_ni(x: float) -> float:
    return max(0, min(x, BASIC_TOP) - PA) * .08 + max(0, x - BASIC_TOP) * .02


def umbrella_net(gross: float) -> float:
    # Salary s satisfies: s + employer NI on (s - threshold) + levy on s + fee = gross.
    salary = (gross - UMBRELLA_FEE_YEAR + NI_THRESHOLD * EMPLOYER_NI) / (1 + EMPLOYER_NI + LEVY)
    return salary - income_tax(salary) - employee_ni(salary)


def ltd_net(gross: float, expenses: float = 3000) -> float:
    salary = PA
    profit = gross - salary - (salary - NI_THRESHOLD) * EMPLOYER_NI - expenses
    corp = profit * .19 if profit <= 50000 else 50000 * .19 + (min(profit, 250000) - 50000) * .265
    dividends = profit - corp
    taxable = max(0, dividends - 500)
    basic = min(taxable, BASIC_TOP - salary)
    return salary + dividends - (basic * .1075 + (taxable - basic) * .3575)


def employer_cost(salary: float) -> float:
    pension = max(0, min(salary, BASIC_TOP) - 6240) * .03
    return salary + max(0, salary - NI_THRESHOLD) * EMPLOYER_NI + pension


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rates", type=float, nargs="+", default=[700, 800])
    ap.add_argument("--days", type=float, default=138, help="billable days a year (3 days/week ≈ 138)")
    ap.add_argument("--fte", type=float, nargs="*", default=[], help="full-time-equivalent salaries the client advertised")
    ap.add_argument("--fraction", type=float, default=0.6, help="part-time fraction, e.g. 0.6 for 3 days")
    ap.add_argument("--margin", type=float, default=0.15, help="assumed agency margin on a contractor rate")
    a = ap.parse_args()
    print("Contractor (estimates, 2026/27):")
    for r in a.rates:
        g = r * a.days
        print(f"  £{r:.0f}/day x {a.days:.0f} = £{g:,.0f}/yr gross | inside IR35 net ≈ £{umbrella_net(g)/12:,.0f}/mo"
              f" | outside (Ltd) net ≈ £{ltd_net(g)/12:,.0f}/mo | client pays ≈ £{g*(1+a.margin):,.0f}/yr at {a.margin:.0%} margin")
    if a.fte:
        print("Employer view of the advertised band:")
        for f in a.fte:
            s = f * a.fraction
            c = employer_cost(s)
            print(f"  £{f:,.0f} FTE -> £{s:,.0f} actual -> employer cost ≈ £{c:,.0f}/yr ≈ £{c / a.days:,.0f}/day worked")
    print("Check with an accountant before relying on these. Excludes pension, student loan and holiday-pay treatment.")


if __name__ == "__main__":
    main()
