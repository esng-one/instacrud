#!/usr/bin/env python
"""
Test runner that runs all *_test.py files in mock or live mode.

In mock mode, a single MongoDB testcontainer is started and reused across
all test files (handled by session-scoped fixtures in conftest.py).

Usage:
    pytest test/run_all_test.py [--type mock|live] [pytest_args...]
    python test/run_all_test.py [--type mock|live] [pytest_args...]

Examples:
    pytest test/run_all_test.py                    # Run all tests in mock mode
    pytest test/run_all_test.py --type=live -v    # Run all tests against live DB
    python test/run_all_test.py --type=live -v    # Same, using direct execution

When run via pytest, conftest.py expands this file to all *_test.py files.
When run directly with python, pytest.main() is called with all test files.
"""

import sys
from pathlib import Path
import pytest


def get_test_files():
    """Find all test files (exclude this runner script)."""
    test_dir = Path(__file__).parent
    # firestore_test.py excluded — it performs real cloud operations against GCP
    exclude = {"run_all_test.py", "firestore_test.py"}
    return sorted(
        str(tf) for tf in test_dir.glob("*_test.py")
        if tf.name not in exclude
    )


def main():
    """Run all tests using pytest.main() for proper integration."""
    test_files = get_test_files()

    if not test_files:
        print("No test files found matching *_test.py")
        return 1

    print(f"Found {len(test_files)} test file(s):")
    for tf in test_files:
        print(f"  - {Path(tf).name}")
    print()

    # Build pytest args: test files + any CLI args (excluding this script)
    pytest_args = test_files + sys.argv[1:]

    return pytest.main(pytest_args)


if __name__ == "__main__":
    sys.exit(main())
