"""Execute the financial notebook and verify its saved numerical outputs."""

from pathlib import Path

import nbformat
from nbclient import NotebookClient


def text_results(notebook):
    # Figure encoding can vary by environment. Compare the inspectable numeric tables.
    return [
        output.get("text", "") if output.output_type == "stream"
        else output.get("data", {}).get("text/plain", "")
        for cell in notebook.cells if cell.cell_type == "code"
        for output in cell.get("outputs", [])
        if output.output_type != "error"
        and "image/png" not in output.get("data", {})
    ]


path = Path(__file__).resolve().parents[1] / "preservation_economics.ipynb"
notebook = nbformat.read(path, as_version=4)
nbformat.validate(notebook)
expected = text_results(notebook)
NotebookClient(notebook, timeout=120, kernel_name="python3",
               resources={"metadata": {"path": str(path.parent)}}).execute()
assert text_results(notebook) == expected, "Fresh financial results differ from the saved notebook."
print("All notebook cells executed and reproduced the saved numerical results.")
