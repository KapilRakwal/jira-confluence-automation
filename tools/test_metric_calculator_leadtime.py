import contextlib
import io
import unittest
from unittest.mock import Mock, patch

import metric_calculator_leadtime as calculator


def issue(created, resolved, category="done"):
    return {
        "fields": {
            "created": created,
            "resolutiondate": resolved,
            "status": {"statusCategory": {"key": category}},
        }
    }


class LeadTimeTests(unittest.TestCase):
    def test_timezone_offsets_are_respected(self):
        days = calculator.lead_time_days(
            "2026-01-01T10:00:00.000+0200",
            "2026-01-02T10:00:00.000+0000",
        )
        self.assertAlmostEqual(days, 26 / 24)

    def test_invalid_timestamps_are_rejected(self):
        with self.assertRaises(ValueError):
            calculator.lead_time_days("2026-01-02T00:00:00+00:00", "2026-01-01T00:00:00+00:00")
        with self.assertRaises(ValueError):
            calculator.lead_time_days("2026-01-01T00:00:00", "2026-01-02T00:00:00")

    @patch.dict("os.environ", {"ATLASSIAN_SITE": "https://example.test", "ATLASSIAN_EMAIL": "test@example.test", "ATLASSIAN_TOKEN": "test-token"})
    @patch("metric_calculator_leadtime.requests.get")
    def test_cli_median_and_exclusions(self, get):
        def response(url, **kwargs):
            key = url.rsplit("/", 1)[-1]
            issues = {
                "SCRUM-1": issue("2026-01-01T00:00:00+0000", "2026-01-03T00:00:00+0000"),
                "SCRUM-2": issue("2026-01-01T00:00:00+0000", "2026-01-05T00:00:00+0000"),
                "SCRUM-3": issue("2026-01-01T00:00:00+0000", None),
                "SCRUM-4": issue("2026-01-01T00:00:00+0000", "2026-01-03T00:00:00+0000", "indeterminate"),
            }
            return Mock(status_code=200, json=Mock(return_value=issues[key]))

        get.side_effect = response
        out = io.StringIO()
        with patch("sys.argv", ["leadtime", "SCRUM-1", "SCRUM-2", "SCRUM-3", "SCRUM-4", "SCRUM-1"]), contextlib.redirect_stdout(out):
            self.assertEqual(calculator.main(), 0)
        self.assertEqual(
            out.getvalue(),
            "SCRUM-1: 2.00 days\n"
            "SCRUM-2: 4.00 days\n"
            "SCRUM-3: excluded (missing resolution date)\n"
            "SCRUM-4: excluded (not completed)\n"
            "Team median (supplied completed tickets, n=2): 3.00 days\n",
        )
        self.assertEqual(get.call_count, 4)

    @patch.dict("os.environ", {"ATLASSIAN_SITE": "https://example.test", "ATLASSIAN_EMAIL": "test@example.test", "ATLASSIAN_TOKEN": "test-token"})
    @patch("metric_calculator_leadtime.requests.get")
    def test_api_error_does_not_print_partial_results(self, get):
        get.side_effect = [
            Mock(status_code=200, json=Mock(return_value=issue("2026-01-01T00:00:00+0000", "2026-01-02T00:00:00+0000"))),
            Mock(status_code=403),
        ]
        out, err = io.StringIO(), io.StringIO()
        with patch("sys.argv", ["leadtime", "SCRUM-1", "SCRUM-2"]), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            with self.assertRaises(SystemExit) as exc:
                calculator.main()
        self.assertEqual(exc.exception.code, 1)
        self.assertEqual(out.getvalue(), "")
        self.assertIn("SCRUM-2: Jira returned HTTP 403", err.getvalue())


if __name__ == "__main__":
    unittest.main()
