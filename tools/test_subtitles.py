import tempfile
import unittest
from pathlib import Path
from build_songs import parse_srt


class SubtitleTimingTests(unittest.TestCase):
    def parse(self, source, duration=60, lang=None):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'lyrics.srt'
            file.write_text(source, encoding='utf-8')
            return parse_srt(file, duration, lang)

    def test_keep_long_cue_and_silence(self):
        lines, _ = self.parse('1\n00:00:01,025 --> 00:00:13,525\nA long English lyric\n\n2\n00:00:20,000 --> 00:00:22,125\n次の歌詞\n')
        self.assertEqual(lines[0]['t'], 1.025)
        self.assertEqual(lines[0]['d'], 12.5)
        self.assertEqual(lines[1]['t'], 20)
        self.assertEqual(lines[1]['text'], '次の歌詞')

    def test_reject_overlap(self):
        with self.assertRaisesRegex(ValueError, 'Overlapping'):
            self.parse('1\n00:00:01,000 --> 00:00:03,000\none\n\n2\n00:00:02,000 --> 00:00:04,000\ntwo\n')

    def test_bilingual_source_keeps_primary_lyric_separate(self):
        lines, _ = self.parse('1\n00:00:01,000 --> 00:00:03,000\nLucky cat Bu Bu\n招財貓布布\n', lang='en')
        self.assertEqual(lines[0]['text'], 'Lucky cat Bu Bu')
        self.assertEqual(lines[0]['translation'], '招財貓布布')
        lines, _ = self.parse('1\n00:00:01,000 --> 00:00:03,000\nねこのブブ\nふくをはこぶ\n', lang='ja')
        self.assertEqual(lines[0]['text'], 'ねこのブブ ふくをはこぶ')
        self.assertNotIn('translation', lines[0])

    def test_reject_outside_audio(self):
        with self.assertRaisesRegex(ValueError, 'outside audio'):
            self.parse('1\n00:00:59,000 --> 00:01:02,000\nlate\n')


if __name__ == '__main__':
    unittest.main()
