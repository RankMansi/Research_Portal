"""
Google Scholar API integration using SerpAPI.
This module extracts citation metrics from Google Scholar profiles.
"""
import os
import re
from typing import Dict, Optional
from dotenv import load_dotenv
from serpapi import GoogleSearch

# Load environment variables
load_dotenv()

# API Configuration
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

def extract_scholar_id(url: str) -> Optional[str]:
    """
    Extract Google Scholar ID from URL.
    
    Args:
        url: Google Scholar profile URL
        
    Returns:
        Scholar ID if found, None otherwise
    """
    # Pattern for Google Scholar profile URLs
    pattern = r'user=([^&]+)'
    match = re.search(pattern, url)
    
    if match:
        return match.group(1)
    return None

def get_scholar_metrics(url: str) -> Dict:
    """
    Get Google Scholar metrics using SerpAPI.
    
    Args:
        url: Google Scholar profile URL
        
    Returns:
        Dictionary with citations, h-index, and i10-index
    """
    if not SERPAPI_KEY:
        print("WARNING: No SerpAPI key provided. Using fallback extraction.")
        return _extract_metrics_directly(url)
    
    scholar_id = extract_scholar_id(url)
    if not scholar_id:
        print(f"Could not extract Scholar ID from URL: {url}")
        return _extract_metrics_directly(url)
    
    try:
        # Set up SerpAPI parameters for Google Scholar Author
        params = {
            "engine": "google_scholar_author",
            "author_id": scholar_id,
            "api_key": SERPAPI_KEY,
            "hl": "en"  # Language parameter
        }
        
        # Execute search
        print(f"Making SerpAPI request for author_id: {scholar_id}")
        search = GoogleSearch(params)
        results = search.get_dict()
        
        print(f"Full response keys: {list(results.keys())}")
        
        # Check if we have the raw HTML file URL for fallback
        raw_html_url = results.get("search_metadata", {}).get("raw_html_file")
        if raw_html_url:
            print(f"Found raw HTML file: {raw_html_url}")
            # Try to extract from the raw HTML
            try:
                import requests
                response = requests.get(raw_html_url, timeout=10)
                if response.status_code == 200:
                    print(f"Successfully fetched raw HTML, length: {len(response.text)}")
                    return _extract_metrics_from_html(response.text)
            except Exception as e:
                print(f"Error fetching raw HTML: {e}")
        
        # Check if the API call was successful
        if not results or len(results) < 3:
            print(f"API call may have failed. Response: {results}")
            return _extract_metrics_directly(url)
        
        # Print the full response structure for debugging
        print("Full response structure:")
        for key, value in results.items():
            if isinstance(value, dict):
                print(f"  {key}: {list(value.keys()) if value else 'empty'}")
            elif isinstance(value, list):
                print(f"  {key}: list with {len(value)} items")
            else:
                print(f"  {key}: {value}")
        
        # Extract metrics from the cited_by section
        cited_by = results.get("cited_by", {})
        print(f"Cited by section: {cited_by}")
        
        # Initialize metrics
        citations = 0
        h_index = 0
        i10_index = 0
        
        # The SerpAPI response structure for Google Scholar Author
        # should have a table with metrics in the cited_by section
        if cited_by and "table" in cited_by:
            table = cited_by["table"]
            print(f"Found table with {len(table) if isinstance(table, list) else 'dict'} items")
            
            if isinstance(table, list):
                # Table is a list of metric objects
                for item in table:
                    print(f"Processing table item: {item}")
                    if "citations" in item:
                        citations = item["citations"].get("all", 0)
                        print(f"Found citations: {citations}")
                    elif "h_index" in item:
                        h_index = item["h_index"].get("all", 0)
                        print(f"Found h_index: {h_index}")
                    elif "i10_index" in item:
                        i10_index = item["i10_index"].get("all", 0)
                        print(f"Found i10_index: {i10_index}")
            elif isinstance(table, dict):
                # Table is a dictionary with metric keys
                print("Table is a dictionary, extracting values directly")
                citations = table.get("citations", {}).get("all", 0)
                h_index = table.get("h_index", {}).get("all", 0)
                i10_index = table.get("i10_index", {}).get("all", 0)
        
        # If we didn't get metrics from the table, try alternative locations
        if citations == 0 and h_index == 0 and i10_index == 0:
            print("No metrics found in table, trying alternative extraction methods")
            
            # Try to get metrics from articles if available
            articles = results.get("articles", [])
            if articles:
                print(f"Found {len(articles)} articles")
                total_citations = sum(article.get("cited_by", {}).get("value", 0) for article in articles if article.get("cited_by"))
                if total_citations > 0:
                    # Calculate h-index and i10-index from articles
                    citation_counts = [article.get("cited_by", {}).get("value", 0) for article in articles if article.get("cited_by")]
                    citation_counts.sort(reverse=True)
                    
                    # Calculate h-index
                    h_index = 0
                    for i, count in enumerate(citation_counts, 1):
                        if count >= i:
                            h_index = i
                        else:
                            break
                    
                    # Calculate i10-index
                    i10_index = sum(1 for count in citation_counts if count >= 10)
                    
                    citations = total_citations
                    print(f"Calculated metrics from articles: citations={citations}, h_index={h_index}, i10_index={i10_index}")
        
        print(f"Final extracted metrics: citations={citations}, h_index={h_index}, i10_index={i10_index}")
        
        return {
            "citations": int(citations),
            "h_index": int(h_index),
            "i10_index": int(i10_index)
        }
        
    except Exception as e:
        print(f"Error extracting metrics from SerpAPI: {e}")
        import traceback
        traceback.print_exc()
        return _extract_metrics_directly(url)

def _extract_metrics_from_html(html_content: str) -> Dict:
    """
    Extract metrics from HTML content
    """
    try:
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        print(f"HTML content length: {len(html_content)}")
        print(f"Looking for metrics table...")
        
        # Look for the metrics table - try multiple selectors
        metrics_table = soup.select('table.gsc_rsb_stats')
        if not metrics_table:
            metrics_table = soup.select('.gsc_rsb_stats')
        if not metrics_table:
            metrics_table = soup.select('table[class*="gsc"]')
        if not metrics_table:
            metrics_table = soup.select('table')
        
        print(f"Found {len(metrics_table)} potential metrics tables")
        
        for i, table in enumerate(metrics_table):
            print(f"Examining table {i+1}: {table.get('class', 'no-class')}")
            
            # Look for rows with citation metrics
            rows = table.select('tr')
            print(f"Table {i+1} has {len(rows)} rows")
            
            if len(rows) >= 3:
                # Initialize metrics for this table
                citations = 0
                h_index = 0
                i10_index = 0
                
                # Try to extract metrics from different positions
                for row_idx, row in enumerate(rows):
                    cells = row.select('td')
                    if len(cells) >= 2:
                        cell_text = [cell.get_text(strip=True) for cell in cells]
                        print(f"Row {row_idx}: {cell_text}")
                        
                        # Look for citation-related text
                        if any(keyword in ' '.join(cell_text).lower() for keyword in ['citation', 'cited']):
                            try:
                                # Try to extract the number from the second column (index 1)
                                citations = int(cells[1].get_text(strip=True))
                                print(f"Found citations: {citations}")
                                break
                            except (ValueError, IndexError):
                                continue
                
                # Now look for h-index and i10-index
                for row in rows:
                    row_text = row.get_text().lower()
                    if 'h-index' in row_text or 'h index' in row_text:
                        try:
                            cells = row.select('td')
                            if len(cells) >= 2:
                                h_index = int(cells[1].get_text(strip=True))
                                print(f"Found h-index: {h_index}")
                        except (ValueError, IndexError):
                            pass
                    elif 'i10-index' in row_text or 'i10 index' in row_text:
                        try:
                            cells = row.select('td')
                            if len(cells) >= 2:
                                i10_index = int(cells[1].get_text(strip=True))
                                print(f"Found i10-index: {i10_index}")
                        except (ValueError, IndexError):
                            pass
                
                # If we found any metrics, return them
                if citations > 0 or h_index > 0 or i10_index > 0:
                    print(f"HTML extraction successful: citations={citations}, h_index={h_index}, i10_index={i10_index}")
                    return {
                        "citations": citations,
                        "h_index": h_index,
                        "i10_index": i10_index
                    }
        
        # If no metrics found in tables, try to find them in other elements
        print("No metrics found in tables, trying alternative selectors...")
        
        # Look for citation numbers in various elements
        citation_elements = soup.select('[class*="citation"], [class*="cited"], .gsc_rsb_c1, .gsc_rsb_c2')
        if citation_elements:
            print(f"Found {len(citation_elements)} potential citation elements")
            for elem in citation_elements:
                text = elem.get_text(strip=True)
                print(f"Citation element text: {text}")
        
        print("HTML extraction failed - metrics table not found")
        
    except Exception as e:
        print(f"Error during HTML extraction: {e}")
        import traceback
        traceback.print_exc()
    
    return {
        "citations": 0,
        "h_index": 0,
        "i10_index": 0
    }

def _extract_metrics_directly(url: str) -> Dict:
    """
    Fallback method to extract metrics directly from Google Scholar page
    """
    try:
        import requests
        from bs4 import BeautifulSoup
        
        print(f"Attempting direct extraction from URL: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Try to access the URL directly
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            return _extract_metrics_from_html(response.text)
        else:
            print(f"Direct extraction failed - HTTP {response.status_code}")
            
    except Exception as e:
        print(f"Error during direct extraction: {e}")
    
    return {
        "citations": 0,
        "h_index": 0,
        "i10_index": 0
    }

        
def test_serpapi_connection() -> bool:
    """Test the connection to SerpAPI."""
    if not SERPAPI_KEY:
        print("No SerpAPI key found in environment variables.")
        return False
        
    try:
        # Simple test query with a known scholar
        params = {
            "engine": "google_scholar_author",
            "author_id": "DAcGr9AAAAAJ",  # Example ID (Andrew Ng)
            "api_key": SERPAPI_KEY
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        if "author" in results:
            print("Successfully connected to SerpAPI for Google Scholar.")
            return True
        else:
            print("Failed to retrieve author data from SerpAPI.")
            return False
    except Exception as e:
        print(f"Error connecting to SerpAPI: {e}")
        return False

if __name__ == "__main__":
    # Test the API connection
    test_serpapi_connection()
