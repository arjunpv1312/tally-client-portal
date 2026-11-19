import unittest

from scripts.verify_pipeline import contains_test_marker


class VerifyPipelineTests(unittest.TestCase):
    def test_test_marker_matches_e2e_and_legacy_ids(self) -> None:
        self.assertTrue(contains_test_marker("__FINORA_E2E_TEST__ Corp"))
        self.assertTrue(contains_test_marker("TEST_BATCH_001"))
        self.assertTrue(contains_test_marker("Purchase TEST 001"))

    def test_test_marker_does_not_match_contest_word(self) -> None:
        self.assertFalse(contains_test_marker("Contest Supplies"))


if __name__ == "__main__":
    unittest.main()
