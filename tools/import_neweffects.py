"""Snapshot the nine four-language song families from a NewEffects checkout.

Read-only on the source checkout. Run before build_songs.py, with the same
EFFECTS_SONG_SOURCE directory, or pass the directory as the first argument.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'


def import_songs(source):
    source = Path(source).resolve()
    songs = json.loads((ROOT / 'data/song_sources.json').read_text(encoding='utf-8'))
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    snapshots = []
    # Preflight all 36 editions before changing the destination.
    for song in songs:
        stem = source / song['sourceStem']
        audio = Path(str(stem) + '.mp3')
        subtitle = Path(str(stem) + '.srt')
        if not audio.is_file() or not audio.stat().st_size:
            raise FileNotFoundError(audio)
        refs = []
        if subtitle.is_file():
            raw = subtitle.read_bytes()
            refs.append(subtitle)
        else:
            # A newly added edition may have canonical lyrics/timing before
            # its generated SRT is written. Never borrow another language's time.
            ref = source / 'assets/ref' / song['sourceRef']
            lyrics = ref / f"lyrics-{song['lang']}.txt"
            timings = ref / f"timings-{song['lang']}.json"
            lines = [line for line in lyrics.read_text(encoding='utf-8').splitlines() if line.strip()]
            timeline = json.loads(timings.read_text(encoding='utf-8'))
            cues = timeline['cues']
            omitted = timeline.get('omitted', [])
            covered = {cue['line'] for cue in cues}
            if covered | {cue['line'] for cue in omitted} != set(range(1, len(lines) + 1)):
                raise ValueError('Incomplete source lyric coverage: ' + str(lyrics))
            if any(not cue.get('reason') for cue in omitted):
                raise ValueError('Missing omission reason: ' + str(timings))
            blocks = []
            for i, cue in enumerate(cues):
                if (cue['start'] < 0 or cue['end'] <= cue['start'] or
                    cue['end'] > timeline['duration'] or
                    (i and cue['start'] < cues[i - 1]['end'])):
                    raise ValueError('Invalid source timing: ' + str(timings))
                blocks.append(f"{i + 1}\n{stamp(cue['start'])} --> {stamp(cue['end'])}\n{lines[cue['line'] - 1]}\n")
            raw = '\n'.join(blocks).encode('utf-8')
            refs.extend([lyrics, timings])
        source_files = [audio, *refs]
        records = []
        for file in source_files:
            name = file.relative_to(source).as_posix()
            status = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain', '--', name], text=True).strip()
            records.append({'path': name, 'sha256': digest(file.read_bytes()),
                            'state': 'working-tree' if status else 'committed'})
        snapshots.append((song, audio, raw, records))
    (ROOT / 'data/lyrics').mkdir(exist_ok=True)
    (ROOT / 'audio').mkdir(exist_ok=True)
    provenance = {'repository': 'https://github.com/goldshoot0720/NewEffects',
                  'revision': revision, 'songs': []}
    for song, audio, raw, records in snapshots:
        sid = song['id']
        shutil.copyfile(audio, ROOT / 'audio' / f'{sid}.mp3')
        (ROOT / 'data/lyrics' / f'{sid}.srt').write_bytes(raw)
        provenance['songs'].append({'id': sid, 'sources': records, 'subtitleSha256': digest(raw)})
    (ROOT / 'data/import-neweffects.json').write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(snapshots)} editions from NewEffects ({revision[:7]}). Source checkout unchanged.')


if __name__ == '__main__':
    import_songs(sys.argv[1] if len(sys.argv) > 1 else os.environ['EFFECTS_SONG_SOURCE'])
