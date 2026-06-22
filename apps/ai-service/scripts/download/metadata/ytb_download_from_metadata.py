import runpy
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("2_download_from_csv.py")


if __name__ == "__main__":
    runpy.run_path(str(SCRIPT_PATH), run_name="__main__")
