import argparse
from decimal import Decimal, InvalidOperation


def nonnegative_decimal(value):
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise argparse.ArgumentTypeError("must be a number") from exc
    if not number.is_finite() or number < 0:
        raise argparse.ArgumentTypeError("must be a finite nonnegative number")
    return number


def positive_integer(value):
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if number <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description="Calculate compound interest.")
    parser.add_argument("principal", type=nonnegative_decimal, help="initial amount")
    parser.add_argument("annual_rate", type=nonnegative_decimal, help="annual interest rate as a percentage")
    parser.add_argument("compounds_per_year", type=positive_integer, help="number of compounding periods per year")
    parser.add_argument("years", type=nonnegative_decimal, help="total years")
    args = parser.parse_args()

    rate = args.annual_rate / Decimal(100)
    amount = args.principal * (1 + rate / args.compounds_per_year) ** (args.compounds_per_year * args.years)
    print(f"Final amount: ${amount:,.2f}")
    print(f"Interest earned: ${amount - args.principal:,.2f}")


if __name__ == "__main__":
    main()
