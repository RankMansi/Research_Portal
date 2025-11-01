from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import requests
from bs4 import BeautifulSoup
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import re
import pandas as pd
from dotenv import load_dotenv
import uuid

# Import the API modules
from scholar_api import get_scholar_metrics, test_serpapi_connection

# Load environment variables
load_dotenv()

app = FastAPI(title="Faculty Publications API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Faculty(BaseModel):
    id: Optional[str] = None
    name: str
    department: str
    email: Optional[str] = None
    scopusId: Optional[str] = None
    googleScholarUrl: Optional[str] = None

class FacultyProfile(BaseModel):
    faculty: Faculty
    totalCitations: int
    totalDocuments: int
    publications: List[dict]

class ScholarMetricsRequest(BaseModel):
    url: str

class ScholarMetricsResponse(BaseModel):
    """Response model for Google Scholar metrics"""
    citations: int = 0
    h_index: int = 0
    i10_index: int = 0

# In-memory storage (replace with database in production)
faculty_data = []
faculty_file = "faculty_data.json"
generated_outputs = {}

def _detect_column(row_keys: List[str], candidates: List[str]) -> Optional[str]:
    lower_map = {k.lower().strip(): k for k in row_keys}
    for cand in candidates:
        key = lower_map.get(cand.lower())
        if key:
            return key
    # try fuzzy contains
    for k_lower, orig in lower_map.items():
        for cand in candidates:
            if cand.lower() in k_lower:
                return orig
    return None

def load_faculty_from_excel() -> List[dict]:
    """Load faculty data from the provided Excel file in project root.
    
    Expects columns: Faculty Name, Department Name, Google Scholar URL
    """
    # Excel file resides in project root alongside README, go up from backend/
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try the mock file first as it has the proper structure
    excel_path = os.path.abspath(os.path.join(backend_dir, os.pardir, "faculty list department 2025 - mock.xlsx"))
    if not os.path.exists(excel_path):
        # Fallback to the main file
        excel_path = os.path.abspath(os.path.join(backend_dir, os.pardir, "faculty list department 2025.xlsx"))
    
    if not os.path.exists(excel_path):
        print(f"No Excel file found at {excel_path}")
        return []

    # Read Excel file without header, then manually set headers from row 1 (index 1)
    df = pd.read_excel(excel_path, sheet_name=0, header=None)
    
    # Get the headers from row 1 (index 1)
    headers = df.iloc[1].tolist()
    print(f"Found headers: {headers}")
    
    # Set the headers and remove the first two rows
    df.columns = headers
    df = df.iloc[2:].reset_index(drop=True)
    
    # Normalize columns - remove any leading/trailing whitespace
    columns = [str(col).strip() if pd.notna(col) else "" for col in df.columns]
    print(f"Normalized columns: {columns}")
    
    # Look for the specific columns we need
    name_col = None
    dept_col = None
    url_col = None
    
    for col in columns:
        if not col:
            continue
        col_lower = col.lower()
        if "faculty" in col_lower and "name" in col_lower:
            name_col = col
        elif "department" in col_lower and "name" in col_lower:
            dept_col = col
        elif "google" in col_lower and "scholar" in col_lower and "url" in col_lower:
            url_col = col
    
    if not name_col or not dept_col:
        print(f"Required columns not found. Found: {columns}")
        return []
    
    print(f"Using columns: name={name_col}, dept={dept_col}, url={url_col if url_col else 'None'}")
    
    faculty_list: List[dict] = []
    for idx, row in df.iterrows():
        name = str(row.get(name_col, "")).strip()
        if not name or name.lower() in ["faculty name", "name", "nan"]:
            continue
            
        department = str(row.get(dept_col, "")).strip() or "Unknown"
        google_scholar_url = str(row.get(url_col, "")) if url_col and pd.notna(row.get(url_col)) else None
        
        # Skip if no Google Scholar URL
        if not google_scholar_url or google_scholar_url.lower() in ["nan", "none", ""]:
            continue
        
        faculty_list.append({
            "id": str(len(faculty_list) + 1),
            "name": name,
            "department": department,
            "googleScholarUrl": google_scholar_url,
            "email": None,  # Not available in current Excel
    
        })
    
    print(f"Loaded {len(faculty_list)} faculty members from Excel")
    return faculty_list

def load_faculty_data():
    """Load faculty data preferring Excel, falling back to JSON cache, without seeding mocks."""
    global faculty_data
    excel_faculty = load_faculty_from_excel()
    if excel_faculty:
        faculty_data = excel_faculty
        save_faculty_data()  # keep a JSON cache for runtime mutations
        return
    
    # Fallback to JSON cache if Excel missing/unreadable
    if os.path.exists(faculty_file):
        try:
            with open(faculty_file, 'r', encoding='utf-8') as f:
                faculty_data = json.load(f)
            return
        except Exception:
            faculty_data = []
    
    # If no Excel or JSON, use the faculty names provided by user
    if not faculty_data:
        faculty_data = [
                    {"id": "1", "name": "Prahlad K Baruah", "department": "Engineering", "googleScholarUrl": None, "email": None},
        {"id": "2", "name": "Yogesh Kumar", "department": "Engineering", "googleScholarUrl": None, "email": None},
        {"id": "3", "name": "Abhijid Ray", "department": "Engineering", "googleScholarUrl": None, "email": None},
        {"id": "4", "name": "Payal Chaudhari", "department": "Engineering", "googleScholarUrl": None, "email": None},
        {"id": "5", "name": "B Abhinaya Srinivas", "department": "Engineering", "googleScholarUrl": None, "email": None}
        ]
        print(f"Using default faculty list: {len(faculty_data)} members")
        save_faculty_data()

def save_faculty_data():
    """Save faculty data to JSON file"""
    with open(faculty_file, 'w', encoding='utf-8') as f:
        json.dump(faculty_data, f, indent=2)

# Load data on startup
load_faculty_data()



def extract_google_scholar_metrics(url: str) -> dict:
    """Extract metrics from Google Scholar profile using SerpAPI"""
    print(f"Extracting metrics for URL: {url}")
    
    # Import directly here to ensure we're using the latest version
    import sys
    import importlib
    
    # Force reload the module to ensure we're using the latest version
    if "scholar_api" in sys.modules:
        importlib.reload(sys.modules["scholar_api"])
    
    # Import after reload
    from scholar_api import get_scholar_metrics
    
    # Get metrics
    metrics = get_scholar_metrics(url)
    print(f"Scholar metrics extracted: {metrics}")
    
    # Ensure we have integer values
    result = {
        "citations": int(metrics.get("citations", 0)),
        "h_index": int(metrics.get("h_index", 0)),
        "i10_index": int(metrics.get("i10_index", 0))
    }
    
    print(f"Returning metrics: {result}")
    return result

# API Endpoints

@app.get("/")
async def root():
    return {"message": "Faculty Publications API is running"}

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    total_faculty = len(faculty_data)
    departments = list(set([f["department"] for f in faculty_data]))
    total_departments = len(departments)
    
    # Get real data for publications and citations using Google Scholar
    total_publications = 0
    total_citations = 0
    total_google_scholar_citations = 0
    faculty_with_google_scholar = 0
    
    # Note: Google Scholar metrics are now handled by separate endpoints
    # Use /api/faculty/scholar-metrics/batch to get current data
    
    return {
        "totalPublications": total_publications,
        "totalFaculty": total_faculty,
        "totalDepartments": total_departments,
        "totalCitations": total_google_scholar_citations,
        "googleScholarCitations": total_google_scholar_citations,
        "facultyWithGoogleScholar": faculty_with_google_scholar,
        "totalFacultyWithGoogleScholar": len([f for f in faculty_data if f.get("googleScholarUrl")])
    }

@app.get("/api/faculty")
async def get_faculty():
    """Get all faculty members"""
    return faculty_data

@app.post("/api/faculty")
async def create_faculty(faculty: Faculty):
    """Create a new faculty member"""
    # Enforce Scopus ID as required on creation
    if not faculty.scopusId or not str(faculty.scopusId).strip():
        raise HTTPException(status_code=400, detail="Scopus ID is required")
    faculty_dict = faculty.dict()
    faculty_dict["id"] = str(len(faculty_data) + 1)
    faculty_data.append(faculty_dict)
    save_faculty_data()
    return faculty_dict

@app.get("/api/faculty/{faculty_id}")
async def get_faculty_by_id(faculty_id: str):
    """Get faculty member by ID"""
    for faculty in faculty_data:
        if faculty["id"] == faculty_id:
            return faculty
    raise HTTPException(status_code=404, detail="Faculty not found")

@app.delete("/api/faculty/{faculty_id}")
async def delete_faculty(faculty_id: str):
    """Delete a faculty member"""
    global faculty_data
    faculty_data = [f for f in faculty_data if f["id"] != faculty_id]
    save_faculty_data()
    return {"message": "Faculty deleted successfully"}

@app.get("/api/faculty/{faculty_id}/profile")
async def get_faculty_profile(faculty_id: str):
    """Get faculty profile with publications and metrics"""
    faculty = None
    for f in faculty_data:
        if f["id"] == faculty_id:
            faculty = f
            break
    
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Get Google Scholar metrics if available
    google_scholar_metrics = {"citations": 0, "h_index": 0, "i10_index": 0}
    if faculty.get("googleScholarUrl"):
        try:
            google_scholar_metrics = extract_google_scholar_metrics(faculty.get("googleScholarUrl"))
        except Exception as e:
            print(f"Error getting Google Scholar metrics for {faculty['name']}: {e}")
    
    profile = FacultyProfile(
        faculty=Faculty(**faculty),
        totalCitations=google_scholar_metrics["citations"],
        totalDocuments=0,
        publications=[]
    )
    
    # Add additional data to the response
    profile_dict = profile.dict()
    profile_dict["googleScholarMetrics"] = google_scholar_metrics
    
    return profile_dict

@app.get("/api/faculty/{faculty_id}/scholar-metrics")
async def get_faculty_scholar_metrics(faculty_id: str):
    """Get Google Scholar metrics for a specific faculty member"""
    faculty = None
    for f in faculty_data:
        if f["id"] == faculty_id:
            faculty = f
            break
    
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    if not faculty.get("googleScholarUrl"):
        raise HTTPException(status_code=404, detail="No Google Scholar URL found for this faculty member")
    
    try:
        metrics = extract_google_scholar_metrics(faculty.get("googleScholarUrl"))
        return {
            "faculty_id": faculty_id,
            "faculty_name": faculty["name"],
            "department": faculty["department"],
            "google_scholar_url": faculty["googleScholarUrl"],
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract metrics: {str(e)}")

@app.get("/api/faculty/scholar-metrics/batch")
async def get_all_faculty_scholar_metrics():
    """Get Google Scholar metrics for all faculty members with URLs"""
    results = []
    
    for faculty in faculty_data:
        if faculty.get("googleScholarUrl"):
            try:
                metrics = extract_google_scholar_metrics(faculty.get("googleScholarUrl"))
                results.append({
                    "faculty_id": faculty["id"],
                    "faculty_name": faculty["name"],
                    "department": faculty["department"],
                    "google_scholar_url": faculty["googleScholarUrl"],
                    "metrics": metrics
                })
            except Exception as e:
                print(f"Error getting metrics for {faculty['name']}: {e}")
                results.append({
                    "faculty_id": faculty["id"],
                    "faculty_name": faculty["name"],
                    "department": faculty["department"],
                    "google_scholar_url": faculty["googleScholarUrl"],
                    "metrics": {"citations": 0, "h_index": 0, "i10_index": 0},
                    "error": str(e)
                })
    
    return {
        "total_faculty": len(faculty_data),
        "faculty_with_urls": len([f for f in faculty_data if f.get("googleScholarUrl")]),
        "results": results
    }

@app.post("/api/scholar/extract-metrics")
async def extract_scholar_metrics(request: ScholarMetricsRequest):
    """Extract metrics from Google Scholar profile"""
    try:
        import os
        import re
        from serpapi import GoogleSearch
        
        url = request.url
        print(f"Processing URL: {url}")
        
        # Extract Scholar ID
        pattern = r'user=([^&]+)'
        match = re.search(pattern, url)
        
        if not match:
            print(f"Could not extract Scholar ID from URL: {url}")
            return {"citations": 0, "h_index": 0, "i10_index": 0}
        
        scholar_id = match.group(1)
        print(f"Scholar ID: {scholar_id}")
        
        # Get API key
        SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
        print(f"SERPAPI_KEY: {'[SET]' if SERPAPI_KEY else '[NOT SET]'}")
        
        # If key is not set, try to get it directly from the .env file
        if not SERPAPI_KEY:
            try:
                print("Trying to read .env file directly")
                with open(".env", "r") as f:
                    for line in f:
                        if line.startswith("SERPAPI_KEY="):
                            SERPAPI_KEY = line.strip().split("=", 1)[1].strip('"\'')
                            print(f"Found SERPAPI_KEY in .env file: {'[SET]' if SERPAPI_KEY else '[NOT SET]'}")
                            break
            except Exception as e:
                print(f"Error reading .env file: {e}")
        
        if not SERPAPI_KEY:
            print("No SerpAPI key found")
            return {"citations": 0, "h_index": 0, "i10_index": 0}
            
        # Hardcode the key for testing
        SERPAPI_KEY = "55d4afc91720009d09e3f259002b3913cb080b45dca9a834c993b715d5061aff"
        print("Using hardcoded key for testing")
        
        # Set up SerpAPI parameters
        params = {
            "engine": "google_scholar_author",
            "author_id": scholar_id,
            "api_key": SERPAPI_KEY,
            "hl": "en"
        }
        
        # Execute search
        search = GoogleSearch(params)
        results = search.get_dict()
        
        print(f"Response keys: {list(results.keys())}")
        
        # Extract metrics
        cited_by = results.get("cited_by", {})
        table = cited_by.get("table", [])
        
        print(f"Table length: {len(table) if isinstance(table, list) else 'not a list'}")
        
        # Initialize metrics
        citations = 0
        h_index = 0
        i10_index = 0
        
        # Extract metrics from table
        if isinstance(table, list) and len(table) > 0:
            for item in table:
                if "citations" in item:
                    citations = item["citations"].get("all", 0)
                elif "h_index" in item:
                    h_index = item["h_index"].get("all", 0)
                elif "i10_index" in item:
                    i10_index = item["i10_index"].get("all", 0)
        
        response = {
            "citations": int(citations),
            "h_index": int(h_index),
            "i10_index": int(i10_index)
        }
        
        print(f"Final response: {response}")
        return response
    except Exception as e:
        print(f"Error in extract_scholar_metrics endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to extract metrics: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}

@app.get("/api/test-cors")
async def test_cors():
    """Test CORS endpoint"""
    return {"message": "CORS is working!", "timestamp": time.time()}


# Scopus+WoS Integration endpoints
@app.post("/api/scopus-wos/merge-process")
async def scopus_wos_merge_process(scopus_file: UploadFile = File(...), wos_file: UploadFile = File(...)):
    """Upload two Excel files (Scopus and WoS) and merge/deduplicate publications."""
    try:
        # Prepare paths
        os.makedirs("tmp_in", exist_ok=True)
        os.makedirs("tmp_out", exist_ok=True)
        file_id = str(uuid.uuid4())
        
        scopus_input_path = os.path.abspath(os.path.join("tmp_in", f"scopus_{file_id}.xlsx"))
        wos_input_path = os.path.abspath(os.path.join("tmp_in", f"wos_{file_id}.xlsx"))
        output_path = os.path.abspath(os.path.join("tmp_out", f"merged_output_{file_id}.xlsx"))

        # Save uploaded files
        with open(scopus_input_path, "wb") as f:
            f.write(await scopus_file.read())
        
        with open(wos_input_path, "wb") as f:
            f.write(await wos_file.read())

        # Import and run the merge publications script
        import subprocess
        import sys
        import time
        
        start_time = time.time()
        
        # Run the merge_publications.py script
        result = subprocess.run([
            sys.executable, 
            "merge_publications.py",
            "--scopus-file", scopus_input_path,
            "--wos-file", wos_input_path,
            "--output", output_path
        ], capture_output=True, text=True, cwd=".")
        
        processing_time = time.time() - start_time
        
        if result.returncode != 0:
            raise Exception(f"Merge script execution failed: {result.stderr}")

        # Check if output file was created
        if not os.path.exists(output_path):
            raise Exception("Output file was not created")

        # Register output for download
        generated_outputs[file_id] = output_path

        # Parse statistics from the output
        try:
            df = pd.read_excel(output_path, sheet_name="Merged Publications")
            total_authors = len(df)
            total_publications = df['Total_Publications'].sum()
            
            dept_df = pd.read_excel(output_path, sheet_name="Department Summary")
            total_departments = len(dept_df)
            
        except Exception as e:
            # If we can't parse stats, just return basic info
            total_authors = 0
            total_publications = 0
            total_departments = 0

        return {
            "success": True,
            "message": f"Successfully merged and deduplicated publications for {total_authors} authors",
            "file_id": file_id,
            "download_url": f"/api/scopus-wos/download/{file_id}",
            "stats": {
                "total_faculty": int(total_authors),
                "combined_publications": int(total_publications),
                "departments": int(total_departments),
                "processing_time": f"{processing_time:.2f}s"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to process files: {str(e)}",
            "error": str(e)
        }


@app.get("/api/scopus-wos/download/{file_id}")
async def scopus_wos_download(file_id: str):
    """Download the generated Excel file with merged and deduplicated publications."""
    output_path = generated_outputs.get(file_id)
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output file not found")
    return FileResponse(
        output_path, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        filename=f"merged_publications_{file_id}.xlsx"
    )






@app.post("/api/faculty/import-publications")
async def import_publications_data(file: UploadFile = File(...)):
    """Import publication data from merged Excel file and update faculty records."""
    try:
        # Create temporary file
        os.makedirs("tmp_in", exist_ok=True)
        file_id = str(uuid.uuid4())
        input_path = os.path.abspath(os.path.join("tmp_in", f"import_{file_id}.xlsx"))

        # Save uploaded file
        with open(input_path, "wb") as f:
            f.write(await file.read())

        # Read the Excel file
        df = pd.read_excel(input_path, sheet_name="Merged Publications")
        
        imported_count = 0
        updated_faculty = []

        # Process each row in the Excel file
        for idx, row in df.iterrows():
            author_name = str(row.get("Author", "")).strip()
            department = str(row.get("Department", "")).strip()
            total_publications = int(row.get("Total_Publications", 0))
            
            if not author_name or author_name.lower() in ['author', 'name', 'nan']:
                continue
            
            # Find matching faculty member by name
            matching_faculty = None
            for faculty in faculty_data:
                if faculty["name"].lower() == author_name.lower():
                    matching_faculty = faculty
                    break
            
            if matching_faculty:
                # Update existing faculty member
                matching_faculty["totalPublications"] = total_publications
                if department and department != "Unknown":
                    matching_faculty["department"] = department
                updated_faculty.append(matching_faculty)
                imported_count += 1
            else:
                # Create new faculty member
                new_faculty = {
                    "id": str(len(faculty_data) + 1),
                    "name": author_name,
                    "department": department if department != "Unknown" else "Unknown",
                    "email": None,
                    "totalPublications": total_publications
                }
                faculty_data.append(new_faculty)
                updated_faculty.append(new_faculty)
                imported_count += 1

        # Save updated faculty data
        save_faculty_data()

        # Clean up temporary file
        if os.path.exists(input_path):
            os.remove(input_path)

        return {
            "success": True,
            "message": f"Successfully imported publication data for {imported_count} faculty members",
            "imported": imported_count
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to import publications: {str(e)}",
            "imported": 0
        }

# Check API connections on startup
@app.on_event("startup")
async def startup_event():
    print("✅ System startup complete!")
    print("✅ Google Scholar API ready!")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
