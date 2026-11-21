"""Execute the financial notebook and verify its saved numerical outputs."""

from pathlib import Path
from difflib import unified_diff

import nbformat
from nbclient import NotebookClient


def text_results(notebook):
    # Jupyter may split the same printed text into different stream chunks.
    # Compare the combined inspectable text from each code cell instead.
    return [
        "".join(
            output.get("text", "") if output.output_type == "stream"
            else output.get("data", {}).get("text/plain", "")
            for output in cell.get("outputs", [])
            if output.output_type != "error"
            and "image/png" not in output.get("data", {})
        )
        for cell in notebook.cells if cell.cell_type == "code"
    ]


path = Path(__file__).resolve().parents[1] / "preservation_economics.ipynb"
notebook = nbformat.read(path, as_version=4)
nbformat.validate(notebook)
expected = text_results(notebook)
NotebookClient(notebook, timeout=120, kernel_name="python3",
               resources={"metadata": {"path": str(path.parent)}}).execute()
actual = text_results(notebook)
if actual != expected:
    for index, (saved, fresh) in enumerate(zip(expected, actual, strict=False)):
        if saved != fresh:
            diff = unified_diff(saved.splitlines(), fresh.splitlines(),
                                fromfile="saved output", tofile="fresh output", lineterm="")
            print(f"First differing text output: {index}")
            print("\n".join(list(diff)[:80]))
            break
    if len(actual) != len(expected):
        print(f"Text output count: saved={len(expected)}, fresh={len(actual)}")
    raise AssertionError("Fresh financial results differ from the saved notebook.")
print("All notebook cells executed and reproduced the saved numerical results.")
