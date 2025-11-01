"""
Compute Google Scholar metrics from Excel file.
"""
import os
import pandas as pd
from typing import Dict, Any

def extract_metrics_from_url(url: str) -> Dict[str, Any]:
    """
    Extract metrics from Google Scholar profile URL.
    """
    # Import the standalone extraction function
    from standalone_extract import extract_scholar_metrics
    
    # Extract metrics
    metrics = extract_scholar_metrics(url)
    
    return {
        "citations": metrics["citations"],
        "h_index": metrics["h_index"],
        "i10_index": metrics["i10_index"]
    }

def compute_scholar_metrics(input_path: str, output_path: str, preview_rows: int = 10) -> Dict[str, Any]:
    """
    Compute Google Scholar metrics from Excel file.
    """
    # Read Excel file
    df = pd.read_excel(input_path, header=1)
    clean_cols = {col: col.strip() for col in df.columns}
    df.rename(columns=clean_cols, inplace=True)
    lower_map = {col.lower(): col for col in df.columns}
    renames = {}
    
    # Find column names
    for key in ["faculty name", "faculty", "name"]:
        if key in lower_map:
            renames[lower_map[key]] = "Name"
            break
    for key in ["department name", "department", "dept"]:
        if key in lower_map:
            renames[lower_map[key]] = "Department"
            break
    for key in ["urls", "profile url", "url"]:
        if key in lower_map:
            renames[lower_map[key]] = "Profile URL"
            break
    
    # Rename columns
    df.rename(columns=renames, inplace=True)
    
    # Set default values
    if "Name" not in df.columns:
        first = df.columns[0]
        df["Name"] = df[first].astype(str)
    if "Department" not in df.columns:
        df["Department"] = "Not Specified"
    if "Profile URL" not in df.columns:
        raise Exception("Input Excel must have a 'URLs' column with Google Scholar profile links.")
    
    # Process each row
    results = []
    for name, dept, profile_url in zip(df["Name"], df["Department"], df["Profile URL"]):
        try:
            # Extract metrics
            metrics = extract_metrics_from_url(profile_url)
            
            # Add to results
            results.append({
                "Name": name,
                "Department": dept,
                "Total Citations": metrics["citations"],
                "h-index": metrics["h_index"],
                "i10-index": metrics["i10_index"],
                "Profile URL": profile_url,
                "Status": "Success"
            })
        except Exception as e:
            # Handle errors
            results.append({
                "Name": name,
                "Department": dept,
                "Total Citations": 0,
                "h-index": 0,
                "i10-index": 0,
                "Profile URL": profile_url,
                "Status": f"Error: {e}"
            })
    
    # Create output DataFrame
    out_df = pd.DataFrame(results)
    
    # Save to Excel
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out_df.to_excel(output_path, index=False)
    
    # Return preview
    return {
        "preview": out_df.head(preview_rows).to_dict("records"),
        "total_faculty": len(out_df),
        "success_count": sum(1 for r in results if r["Status"] == "Success"),
        "failed_count": sum(1 for r in results if r["Status"] != "Success"),
        "output_path": output_path
    }
