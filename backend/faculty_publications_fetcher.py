import pandas as pd
import requests
import time
import argparse
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SCOPUS_API_KEY = os.getenv("SCOPUS_API_KEY", "YOUR_SCOPUS_API_KEY")
INST_TOKEN = os.getenv("INST_TOKEN", "60106943")  # Your institutional token
WOS_API_KEY = os.getenv("WOS_API_KEY", "YOUR_WOS_API_KEY")

YEARS = ["2021", "2022", "2023", "2024", "2025"]

def fetch_scopus_pubs(scopus_id, faculty_name, scopus_api_key=None, inst_token=None):
    """Fetch Scopus publications for a faculty member using institutional token."""
    pubs_by_year = {year: [] for year in YEARS}
    
    if scopus_id == "NA" or pd.isna(scopus_id) or not scopus_id:
        logger.info(f"Skipping Scopus for {faculty_name} - No Scopus ID provided")
        return pubs_by_year
    
    if not scopus_api_key or scopus_api_key == "YOUR_SCOPUS_API_KEY":
        logger.info(f"Skipping Scopus for {faculty_name} - No API key configured")
        return pubs_by_year
    
    if not inst_token or inst_token == "YOUR_INST_TOKEN":
        logger.info(f"Skipping Scopus for {faculty_name} - No institutional token configured")
        return pubs_by_year
    
    base_url = "https://api.elsevier.com/content/search/scopus"
    api_key = scopus_api_key or SCOPUS_API_KEY
    token = inst_token or INST_TOKEN
    
    if not api_key or api_key == "YOUR_SCOPUS_API_KEY":
        logger.info(f"Skipping Scopus for {faculty_name} - Invalid API key")
        return pubs_by_year
    
    if not token or token == "YOUR_INST_TOKEN":
        logger.info(f"Skipping Scopus for {faculty_name} - Invalid institutional token")
        return pubs_by_year
    
    headers = {
        "Accept": "application/json",
        "X-ELS-APIKey": api_key,
        "X-ELS-Insttoken": token
    }
    
    start = 0
    while True:
        params = {
            "query": f"AU-ID({scopus_id})",
            "count": 25,
            "start": start,
            "sort": "pubyear"
        }
        
        try:
            logger.info(f"Fetching Scopus publications for {faculty_name} (start={start})")
            resp = requests.get(base_url, headers=headers, params=params, timeout=30)
            
            if resp.status_code == 403:
                logger.error(f"403 Forbidden for Scopus {faculty_name} - Skipping further Scopus calls")
                break
            elif resp.status_code != 200:
                logger.error(f"HTTP {resp.status_code} error for Scopus {faculty_name}")
                break
            
            data = resp.json()
            
            if "search-results" in data and "entry" in data["search-results"]:
                entries = data["search-results"]["entry"]
                logger.info(f"Found {len(entries)} Scopus publications for {faculty_name}")
                
                for entry in entries:
                    try:
                        title = entry.get("dc:title", "Untitled")
                        cover_date = entry.get("prism:coverDate", "")
                        
                        # Extract year from cover date
                        if cover_date:
                            year = cover_date.split("-")[0]
                            if year in pubs_by_year:
                                pubs_by_year[year].append(title)
                        
                    except Exception as e:
                        logger.error(f"Error parsing Scopus entry for {faculty_name}: {e}")
                        continue
                
                # Check if we have more results
                if len(entries) < 25:
                    break
                start += 25
            else:
                logger.info(f"No Scopus publications found for {faculty_name}")
                break
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error fetching Scopus for {faculty_name}: {e}")
            break
        except Exception as e:
            logger.error(f"Unexpected error fetching Scopus for {faculty_name}: {e}")
            break
        
        time.sleep(0.3)  # Rate limiting
    
    return pubs_by_year

def fetch_wos_pubs(wos_id, faculty_name, wos_api_key=None):
    """Fetch WoS publications for a faculty member."""
    pubs_by_year = {year: [] for year in YEARS}
    
    if wos_id == "NA" or pd.isna(wos_id) or not wos_id:
        logger.info(f"Skipping WoS for {faculty_name} - No WoS ID provided")
        return pubs_by_year
    
    if not wos_api_key or wos_api_key == "YOUR_WOS_API_KEY":
        logger.info(f"Skipping WoS for {faculty_name} - No API key configured")
        return pubs_by_year
    
    base_url = "https://api.clarivate.com/apis/wos-starter/v1/documents"
    api_key = wos_api_key or WOS_API_KEY
    
    if not api_key or api_key == "YOUR_WOS_API_KEY":
        logger.info(f"Skipping WoS for {faculty_name} - Invalid API key")
        return pubs_by_year
    
    headers = {
        "X-ApiKey": api_key,
        "Content-Type": "application/json"
    }
    
    for year in YEARS:
        query = f"AI=({wos_id}) AND PY={year}"
        params = {
            "q": query,
            "limit": 25,
            "offset": 0
        }
        
        try:
            logger.info(f"Fetching WoS publications for {faculty_name}, year {year}")
            resp = requests.get(base_url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            
            data = resp.json()
            
            if "hits" in data:
                records = data["hits"]
                logger.info(f"Found {len(records)} WoS publications for {faculty_name} in {year}")
                
                for record in records:
                    try:
                        title = record.get("title", "Untitled")
                        pubs_by_year[year].append(title)
                        
                    except Exception as e:
                        logger.error(f"Error parsing WoS record for {faculty_name}, year {year}: {e}")
                        continue
            else:
                logger.info(f"No WoS publications found for {faculty_name} in {year}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error fetching WoS for {faculty_name}, year {year}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error fetching WoS for {faculty_name}, year {year}: {e}")
        
        time.sleep(0.3)
    
    return pubs_by_year

def main():
    parser = argparse.ArgumentParser(description="Fetch faculty publications from Scopus and WoS")
    parser.add_argument("--input", required=True, help="Input Excel file path")
    parser.add_argument("--output", required=True, help="Output Excel file path")
    parser.add_argument("--scopus-key", help="Scopus API key (overrides .env)")
    parser.add_argument("--wos-key", help="WoS API key (overrides .env)")
    parser.add_argument("--inst-token", help="Scopus institutional token (overrides .env)")
    
    args = parser.parse_args()
    
    # Use command line arguments if provided, otherwise use .env values
    scopus_key = args.scopus_key or SCOPUS_API_KEY
    wos_key = args.wos_key or WOS_API_KEY
    inst_token = args.inst_token or INST_TOKEN
    
    logger.info(f"Scopus API Key: {scopus_key[:10]}..." if scopus_key != "YOUR_SCOPUS_API_KEY" else "Not configured")
    logger.info(f"WoS API Key: {wos_key[:10]}..." if wos_key != "YOUR_WOS_API_KEY" else "Not configured")
    logger.info(f"Institutional Token: {inst_token[:10]}..." if inst_token != "YOUR_INST_TOKEN" else "Not configured")
    
    # Check if at least one API key is configured
    if scopus_key == "YOUR_SCOPUS_API_KEY" and wos_key == "YOUR_WOS_API_KEY":
        logger.error("No API keys configured! Please set SCOPUS_API_KEY and/or WOS_API_KEY in .env file")
        return
    
    try:
        # Read input Excel file
        df = pd.read_excel(args.input)
        logger.info(f"Loaded {len(df)} faculty members from {args.input}")
        
        # Handle case where first row might be data instead of headers
        if len(df.columns) > 4:
            df = df.iloc[:, :4]  # Take only first 4 columns
        
        # Map columns to expected names
        df.columns = ["FacultyName", "Department", "SCOPUS_ID", "WOS_ID"]
        
        # Drop first row if it contains data instead of headers
        if df.iloc[0]["FacultyName"] in ["FacultyName", "Name", "Author"]:
            df = df.drop(df.index[0]).reset_index(drop=True)
        
        logger.info(f"Processing {len(df)} faculty members")
        
        # Store results
        scopus_results = []
        wos_results = []
        
        for idx, row in df.iterrows():
            faculty_name = str(row["FacultyName"]).strip()
            department = str(row["Department"]).strip()
            scopus_id = str(row["SCOPUS_ID"]).strip()
            wos_id = str(row["WOS_ID"]).strip()
            
            logger.info(f"Processing {idx+1}/{len(df)}: {faculty_name}")
            
            # Fetch Scopus publications
            if scopus_key != "YOUR_SCOPUS_API_KEY":
                scopus_pubs = fetch_scopus_pubs(scopus_id, faculty_name, scopus_key, inst_token)
                
                # Format Scopus results
                scopus_entry = {
                    "FacultyName": faculty_name,
                    "Department": department
                }
                
                for year in YEARS:
                    if scopus_pubs[year]:
                        scopus_entry[year] = "\n".join(scopus_pubs[year])
                    else:
                        scopus_entry[year] = "-"
                
                scopus_results.append(scopus_entry)
            
            # Fetch WoS publications
            if wos_key != "YOUR_WOS_API_KEY":
                wos_pubs = fetch_wos_pubs(wos_id, faculty_name, wos_key)
                
                # Format WoS results
                wos_entry = {
                    "FacultyName": faculty_name,
                    "Department": department
                }
                
                for year in YEARS:
                    if wos_pubs[year]:
                        wos_entry[year] = "\n".join(wos_pubs[year])
                    else:
                        wos_entry[year] = "-"
                
                wos_results.append(wos_entry)
        
        # Save results to Excel
        with pd.ExcelWriter(args.output, engine='openpyxl') as writer:
            if scopus_results:
                scopus_df = pd.DataFrame(scopus_results)
            scopus_df.to_excel(writer, sheet_name="Scopus Publications", index=False)
            logger.info(f"Saved {len(scopus_results)} Scopus records")
            
            if wos_results:
                wos_df = pd.DataFrame(wos_results)
            wos_df.to_excel(writer, sheet_name="WoS Publications", index=False)
            logger.info(f"Saved {len(wos_results)} WoS records")
        
        logger.info(f"✅ Publications saved to {args.output}")
        
    except Exception as e:
        logger.error(f"Error processing file: {e}")
        raise

if __name__ == "__main__":
    main()













# Starter Code:

# import requests, os
# from dotenv import load_dotenv

# load_dotenv()
# WOS_STARTER_KEY = os.getenv("WOS_STARTER_API_KEY")
# WOS_STARTER_HEADER = {"X-ApiKey": WOS_STARTER_KEY}

# base_url = "https://api.clarivate.com/apis/wos-starter/v1/documents"
# params = {
#     "db": "WOS",
#     "q": 'AU="Prof Lastname, Firstname"',
#     "limit": 50,
#     "page": 1
# }

# r = requests.get(base_url, headers=WOS_STARTER_HEADER, params=params)
# data = r.json()

# for hit in data["hits"]:
#     print(hit["title"], hit["source"]["publishYear"])





# Expanded:

# WOS_EXPANDED_KEY = os.getenv("WOS_EXPANDED_API_KEY")
# WOS_EXPANDED_HEADER = {"X-ApiKey": WOS_EXPANDED_KEY}

# expanded_url = "https://api.clarivate.com/apis/wos-expanded/v1/documents"
# params = {
#     "db": "WOS",
#     "q": "AI=YourAuthorID",   # Author Identifier
#     "limit": 50,
#     "page": 1
# }

# r = requests.get(expanded_url, headers=WOS_EXPANDED_HEADER, params=params)
# data = r.json()

# for hit in data["hits"]:
#     print(hit["title"], hit["source"]["publishYear"])

