import csv
import json
import sys
from pathlib import Path


def csv_to_json(csv_path, json_path=None, indent=2):
    """Read a CSV file (first row = headers) and convert it to JSON.

    Returns the JSON string. If json_path is given, also writes it to that file.
    """
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    result = json.dumps(rows, indent=indent, ensure_ascii=False)

    if json_path:
        Path(json_path).write_text(result, encoding="utf-8")
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python csv_to_json.py input.csv [output.json]")
    output = csv_to_json(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    if len(sys.argv) < 3:
        print(output)
