"""
Dataset loader for UI Descriptions from portal-uxagent-dataset.

This script reads the UI Description dataset and returns it as a dictionary
where the key is the folder name (title) and the value is the UI description content.
"""

import os
from pathlib import Path
from typing import Dict


def load_dataset(dataset_path: str = None) -> Dict[str, str]:
    """
    Load the UI Descriptions dataset from the portal-uxagent-dataset folder.
    
    Args:
        dataset_path: Path to the 'UI Descriptions' folder. 
                     If None, will use the default relative path.
    
    Returns:
        A dictionary where:
        - key: folder name (title) - e.g., "001_Portal for Bug triage including a summary of the last reported bugs"
        - value: content of ui-description.md file
    
    Example:
        >>> dataset = load_dataset()
        >>> for title, description in dataset.items():
        ...     print(f"Title: {title}")
        ...     print(f"Description length: {len(description)} chars")
    """
    if dataset_path is None:
        # Default path - assumes script is in portal-ux-agent/eval/dataset/
        # and dataset is in portal-uxagent-dataset/UI Descriptions/
        script_dir = Path(__file__).parent
        dataset_path = script_dir.parent.parent.parent / "portal-uxagent-dataset" / "UI Descriptions"
    else:
        dataset_path = Path(dataset_path)
    
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset path not found: {dataset_path}")
    
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
