#!/usr/bin/env python3
"""Generate the balanced paired-category prototype; daily approval stays separate."""
import runpy
from pathlib import Path
if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('redesign-animalstats-prototype.py')), run_name='__main__')
