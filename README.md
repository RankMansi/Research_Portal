# Faculty Publications & Research Analytics Portal

A comprehensive full-stack web application for managing, tracking, and analyzing faculty research publications and citation metrics across multiple academic databases. This portal integrates Scopus, Web of Science, and Google Scholar data to provide a unified research analytics platform for academic institutions.

## 🎯 Project Overview

This portal serves as a centralized research management system that automates the collection, deduplication, and analysis of faculty publications from multiple academic databases. It addresses the challenge of manually consolidating publication data from disparate sources while ensuring data quality through intelligent deduplication and inflation detection.

## ✨ Key Features

### 1. **Faculty Search & Management**
- Search and filter faculty members by name, department, and year
- View detailed faculty profiles with publication counts and citation metrics
- Add/delete faculty members with Scopus ID integration
- Import publication data from merged Excel files

### 2. **Scopus + Web of Science Integration**
- Upload separate Scopus and WoS Excel exports
- **Intelligent Column Detection**: Automatically identifies author names, titles, years, and source information
- **Advanced Deduplication**: Case-insensitive matching across both sources
- **Inflation Detection**: Filters out meaningless entries (hyphens, symbols, punctuation-only strings)
- **Multi-Author Support**: Automatically splits publications with multiple authors into separate faculty entries
- **Formatted Output**: Generates professional Excel reports with numbered publication lists and department summaries

### 3. **Google Scholar Metrics Extraction**
- Bulk extraction of citation metrics (citations, h-index, i10-index) from Google Scholar profiles
- SerpAPI integration with HTML fallback for robust data extraction
- Real-time processing status tracking for each faculty member
- Export metrics to Excel format

### 4. **Data Quality & Processing**
- Normalizes publication titles for accurate deduplication
- Removes year markers and numbering for consistent matching
- Filters publications shorter than 3 characters
- Handles missing data gracefully with "Unknown" defaults

## 🏗️ Architecture

### Frontend (Next.js 14)
- **Framework**: Next.js 14 with App Router
- **UI Library**: Tailwind CSS with custom components
- **File Handling**: React Dropzone for drag-and-drop file uploads
- **Excel Processing**: Client-side Excel parsing using XLSX library
- **Icons**: Lucide React
- **Charts**: Recharts (for future analytics visualization)

**Key Pages:**
- `/` - Dashboard with navigation to all modules
- `/faculty-search` - Faculty directory and search interface
- `/scopus-wos-integration` - Publication merging tool
- `/scholar-metrics` - Google Scholar metrics extraction

### Backend (FastAPI)
- **Framework**: FastAPI with async support
- **CORS**: Configured for cross-origin requests from Next.js frontend
- **Data Storage**: JSON-based persistence with Excel seeding capability
- **File Processing**: Pandas for Excel manipulation, OpenPyXL for Excel generation
- **API Integration**: SerpAPI for Google Scholar data, with direct HTML scraping fallback

**Key Endpoints:**
- `GET/POST/DELETE /api/faculty` - Faculty CRUD operations
- `GET /api/faculty/{id}/profile` - Faculty profile with metrics
- `POST /api/scopus-wos/merge-process` - Publication merging
- `POST /api/scholar/extract-metrics` - Google Scholar metrics extraction
- `POST /api/faculty/import-publications` - Import merged publications

### Core Processing Modules

**`merge_publications.py`**: 
- Reads Scopus and WoS Excel files
- Extracts and normalizes publication data
- Performs cross-source deduplication
- Detects and filters inflation entries
- Generates formatted Excel output with department summaries

**`scholar_api.py`**:
- Extracts Google Scholar profile IDs from URLs
- Queries SerpAPI for citation metrics
- Falls back to HTML parsing if API unavailable
- Returns structured metrics data

## 🔄 System Workflow

### Publication Merging Process:
1. **Upload**: User uploads Scopus and WoS Excel files via drag-and-drop
2. **Column Detection**: System automatically identifies relevant columns (author, title, year)
3. **Data Extraction**: Extracts publications per author, handling multi-author entries
4. **Cleaning**: Normalizes titles, removes inflation entries, strips formatting
5. **Deduplication**: Performs case-insensitive matching across sources
6. **Output Generation**: Creates formatted Excel with numbered publication lists and statistics
7. **Download**: User downloads processed file with unique publications per faculty member

### Google Scholar Metrics Extraction:
1. **Upload Faculty List**: Excel file with Faculty Name, Department, and Google Scholar URL columns
2. **Column Detection**: Automatically maps columns even with variant header names
3. **Batch Processing**: Sequentially processes each faculty member's Scholar profile
4. **Metrics Extraction**: Uses SerpAPI to fetch citations, h-index, and i10-index
5. **Status Tracking**: Real-time updates showing processing/completed/error status
6. **Export**: Download results as Excel file

### Publication Data Import:
1. **Merge Publications**: Generate merged Excel from Scopus+WoS integration
2. **Import to System**: Upload merged file to update faculty records
3. **Matching**: System matches authors to existing faculty by name (case-insensitive)
4. **Update**: Updates publication counts and departments in faculty database
5. **New Entries**: Creates new faculty records for unmatched authors

## 📊 Data Processing Features

### Deduplication Algorithm
- **Case-Insensitive Matching**: "AI in Healthcare" matches "AI in healthcare"
- **Title Normalization**: Removes numbering, year markers, extra whitespace
- **Cross-Source Merging**: Identifies same publication across Scopus and WoS
- **Preserves Original Format**: Keeps original title formatting in output while matching on normalized versions

### Inflation Detection
Filters out entries containing:
- Only hyphens, dashes, underscores (`-`, `—`, `_`)
- Bullet points and symbols (`•`, `·`, `▪`)
- Punctuation-only strings (`.`, `;`, `:`)
- Short entries (< 3 characters)
- Number/symbol-only strings

### Column Mapping Intelligence
Automatically detects columns by:
- Exact matches (e.g., "Title", "Year")
- Partial matches (e.g., "Author full names", "Source title")
- Case-insensitive comparison
- Fuzzy matching for variations

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.7+
- **SerpAPI Key** (for Google Scholar metrics - get from [serpapi.com](https://serpapi.com))

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd orsp-new-new
```

2. **Install Frontend Dependencies**
```bash
npm install
```

3. **Install Backend Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

4. **Configure Environment Variables**
Create `backend/.env` file:
```env
SERPAPI_KEY=your_serpapi_key_here
```

5. **Run the Application**
```bash
# Option 1: Use the startup script (Windows)
start.bat

# Option 2: Manual startup
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend
npm run dev
```

6. **Access the Portal**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs


## 🔧 Technical Highlights

- **Robust Error Handling**: Graceful fallbacks for API failures and missing data
- **Rate Limiting**: Built-in delays to respect API rate limits
- **File Validation**: Excel format validation and error reporting
- **Progress Tracking**: Real-time status updates for long-running operations
- **Data Persistence**: JSON-based storage with Excel import/export
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Type Safety**: TypeScript on frontend, Pydantic models on backend

## 📝 Usage Examples

### Merging Scopus and WoS Publications
1. Navigate to "Scopus+WoS Integration" from dashboard
2. Download sample Excel file to understand format (optional)
3. Export your Scopus data as Excel
4. Export your WoS data as Excel
5. Drag-and-drop both files into the upload areas
6. Click "Merge & Deduplicate Publications"
7. Wait for processing (shows statistics)
8. Download the merged Excel file

### Extracting Google Scholar Metrics
1. Prepare Excel file with columns: Faculty Name, Department, Google Scholar URL
2. Navigate to "Scholar Metrics"
3. Upload the Excel file
4. Review preview table to verify data
5. Click "Extract Metrics"
6. Monitor progress as each faculty member is processed
7. Export results to Excel

### Importing Publication Counts
1. Generate merged Excel file from Scopus+WoS integration
2. Navigate to "Faculty Search"
3. Click "Import Publications"
4. Upload the merged Excel file
5. System updates faculty records with publication counts
6. View updated counts in faculty list

## 🎓 Academic Use Cases

- **Research Performance Tracking**: Monitor faculty publication productivity
- **NAAC/NIRF Accreditation**: Prepare publication data for institutional assessments
- **Faculty Appraisal**: Track and evaluate individual research contributions

## 👤 Author

[Mansi Rank]  
Semester 7 - ORSP Project  
[PDEU]

---

