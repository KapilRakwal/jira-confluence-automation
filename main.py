from calculator import multiply


def main() -> None:
    first_number = 6
    second_number = 7
    product = multiply(first_number, second_number)
    print(f"{first_number} * {second_number} = {product}")


if __name__ == "__main__":
    main()
