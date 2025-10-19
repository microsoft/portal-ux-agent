"""
Dataset loader for UI Descriptions from portal-uxagent-dataset.

Hard-coded to always load from: <repo-root>/portal-uxagent-dataset/UI Descriptions
"""

from pathlib import Path
from typing import Dict


def resolve_dataset_dir() -> Path:
    """
    Resolve the absolute path to the UI Descriptions dataset.
    Based on this file's location: eval/dataset/load_dataset.py
    Navigates up: eval/dataset -> eval -> portal-ux-agent -> ux-agent (workspace root)
    """
    current_file = Path(__file__).resolve()
    repo_root = current_file.parent.parent.parent  # -> portal-ux-agent
    workspace_root = repo_root.parent  # -> ux-agent (contains portal-ux-agent & portal-uxagent-dataset)
    dataset_dir = workspace_root / "portal-uxagent-dataset" / "UI Descriptions"
    return dataset_dir


def load_dataset() -> Dict[str, str]:
    """
    Load the UI Descriptions dataset.
    
    Returns:
        A dictionary where:
        - key: folder name (title) - e.g., "001_Portal for Bug triage..."
        - value: content of ui-description.md file
    """
    dataset_path = resolve_dataset_dir()
    
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset path not found: {dataset_path}\n"
            f"Expected: <repo-root>/portal-uxagent-dataset/UI Descriptions/"
        )
    
    dataset = {}
    
    # Iterate through all subdirectories in UI Descriptions
    for folder in sorted(dataset_path.iterdir()):
        if not folder.is_dir():
            continue
        
        title = folder.name
        ui_description_file = folder / "ui-description.md"
        
        # Check if ui-description.md exists in the folder
        if ui_description_file.exists():
            with open(ui_description_file, 'r', encoding='utf-8') as f:
                description = f.read()
            dataset[title] = description
        else:
            print(f"Warning: ui-description.md not found in {title}")
    
    return dataset


def get_dataset_info(dataset: Dict[str, str]) -> None:
    """
    Print information about the loaded dataset.
    
    Args:
        dataset: The dataset dictionary returned by load_dataset()
    """
    print(f"Dataset loaded successfully!")
    print(f"Total entries: {len(dataset)}")
    print(f"\nDataset entries:")
    for idx, title in enumerate(dataset.keys(), 1):
        desc_length = len(dataset[title])
        print(f"  {idx}. {title} ({desc_length} chars)")


def main():
    """
    Main function to demonstrate usage of the dataset loader.
    """
    try:
        # Load the dataset
        print(f"Resolved dataset directory: {resolve_dataset_dir()}\n")
        dataset = load_dataset()
        
        # Print dataset info
        get_dataset_info(dataset)
        
        # Example: Print the first entry
        if dataset:
            first_title = list(dataset.keys())[0]
            print(f"\n{'='*80}")
            print(f"Example - First entry:")
            print(f"Title: {first_title}")
            print(f"{'='*80}")
            print(dataset[first_title][:500])  # Print first 500 chars
            print("...")
        
        return dataset
    
    except Exception as e:
        print(f"Error loading dataset: {e}")
        raise


if __name__ == "__main__":
    dataset = main()
