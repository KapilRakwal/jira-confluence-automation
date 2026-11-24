"""Calculate lead time for Jira issues.

Set ATLASSIAN_SITE, ATLASSIAN_EMAIL and ATLASSIAN_TOKEN in the environment.
Run: python tools/metric_calculator_leadtime.py SCRUM-1 SCRUM-2
"""

import argparse
import os
import re
import statistics
import sys
from datetime import datetime
from urllib.parse import urlsplit

import requests


def issue_key(value):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*-[1-9][0-9]*", value):
        raise argparse.ArgumentTypeError("must be a Jira issue key, such as SCRUM-1")
    return value.upper()


def lead_time_days(created, resolved):
    try:
        start = datetime.fromisoformat(created)
        end = datetime.fromisoformat(resolved)
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid creation or resolution timestamp") from exc
    if start.utcoffset() is None or end.utcoffset() is None:
        raise ValueError("creation and resolution timestamps must include time zones")
    days = (end - start).total_seconds() / 86400
    if days < 0:
        raise ValueError("resolution is earlier than creation")
    return days


def fetch_issue(site, auth, key):
    try:
        response = requests.get(
            f"{site}/rest/api/3/issue/{key}",
            auth=auth,
            params={"fields": "created,resolutiondate,status"},
            headers={"Accept": "application/json"},
            timeout=30,
            allow_redirects=False,
        )
        if not 200 <= response.status_code < 300:
            raise ValueError(f"{key}: Jira returned HTTP {response.status_code}")
        data = response.json()
    except requests.RequestException as exc:
        raise ValueError(f"{key}: Jira request failed ({type(exc).__name__})") from exc
    try:
        fields = data["fields"]
        category = fields["status"]["statusCategory"]["key"]
        created = fields["created"]
        resolved = fields["resolutiondate"]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"{key}: Jira response is missing required fields") from exc
    if category != "done":
        return None, "not completed"
    if resolved is None:
        return None, "missing resolution date"
    try:
        return lead_time_days(created, resolved), None
    except ValueError as exc:
        raise ValueError(f"{key}: {exc}") from exc


def main():
    parser = argparse.ArgumentParser(
        description="Print lead times in elapsed days and the median for the supplied completed Jira issues.",
        epilog="Set ATLASSIAN_SITE, ATLASSIAN_EMAIL and ATLASSIAN_TOKEN in the environment.",
    )
    parser.add_argument("tickets", nargs="+", type=issue_key, help="Jira issue keys")
    args = parser.parse_args()

    required = ("ATLASSIAN_SITE", "ATLASSIAN_EMAIL", "ATLASSIAN_TOKEN")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        parser.exit(1, f"Missing environment variables: {', '.join(missing)}\n")
    site = os.environ["ATLASSIAN_SITE"].rstrip("/")
    url = urlsplit(site)
    if url.scheme != "https" or not url.netloc or url.path or url.query or url.fragment or url.username:
        parser.exit(1, "ATLASSIAN_SITE must be an HTTPS Jira site URL without a path or credentials.\n")

    auth = (os.environ["ATLASSIAN_EMAIL"], os.environ["ATLASSIAN_TOKEN"])
    results = []
    try:
        for key in dict.fromkeys(args.tickets):
            days, reason = fetch_issue(site, auth, key)
            results.append((key, days, reason))
    except ValueError as exc:
        parser.exit(1, f"Error: {exc}\n")

    completed = []
    for key, days, reason in results:
        if days is None:
            print(f"{key}: excluded ({reason})")
        else:
            completed.append(days)
            print(f"{key}: {days:.2f} days")
    if not completed:
        print("Team median: unavailable (no completed tickets with a resolution date)", file=sys.stderr)
        return 1
    print(f"Team median (supplied completed tickets, n={len(completed)}): {statistics.median(completed):.2f} days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
