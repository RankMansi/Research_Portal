'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Download, Eye, X } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface FacultyData {
  name: string
  department: string
  url: string
}

interface ScholarMetrics {
  name: string
  department: string
  citations: number
  hIndex: number
  i10Index: number
  url: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
}

export default function ScholarMetrics() {
  const [uploadedData, setUploadedData] = useState<FacultyData[]>([])
  const [metrics, setMetrics] = useState<ScholarMetrics[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

          // Handle Excel files where the first row contains column headers
          let actualData = jsonData
          let columns = Object.keys(jsonData[0] || {})
          let nameKey: string
          let deptKey: string
          let urlKey: string
          
          // Check if first row contains actual data or column headers
          const firstRowValues = Object.values(jsonData[0] || {})
          const hasHeadersInFirstRow = firstRowValues.some(val => 
            typeof val === 'string' && 
            (val.toLowerCase().includes('faculty') || 
             val.toLowerCase().includes('department') || 
             val.toLowerCase().includes('url') ||
             val.toLowerCase().includes('scholar'))
          )
          
          if (hasHeadersInFirstRow) {
            // First row contains headers, use it to create column mapping
            const headerRow = jsonData[0]
            const headerValues = Object.values(headerRow)
            
            // Find which column contains which header
            const nameColIndex = headerValues.findIndex(val => 
              typeof val === 'string' && 
              (val.toLowerCase().includes('faculty') || val.toLowerCase().includes('name'))
            )
            const deptColIndex = headerValues.findIndex(val => 
              typeof val === 'string' && 
              (val.toLowerCase().includes('department') || val.toLowerCase().includes('dept'))
            )
            const urlColIndex = headerValues.findIndex(val => 
              typeof val === 'string' && 
              (val.toLowerCase().includes('url') || val.toLowerCase().includes('scholar') || val.toLowerCase().includes('google'))
            )
            
            // Get column keys for the actual data
            const columnKeys = Object.keys(headerRow)
            nameKey = columnKeys[nameColIndex] || columnKeys[0]
            deptKey = columnKeys[deptColIndex] || columnKeys[1] || columnKeys[0]
            urlKey = columnKeys[urlColIndex] || ''
            
            // Skip the header row for actual data
            actualData = jsonData.slice(1)
            columns = Object.keys(actualData[0] || {})
            
            console.log('Detected headers in first row:', { nameKey, deptKey, urlKey })
          } else {
            // Standard column detection
            nameKey = columns.find(k => k.toLowerCase().includes('faculty') || k.toLowerCase() === 'name' || k.toLowerCase().includes('full')) || columns[0]
            deptKey = columns.find(k => k.toLowerCase().startsWith('dept') || k.toLowerCase().includes('department')) || columns[1] || columns[0]
            urlKey = columns.find(k => 
              k.toLowerCase().includes('url') || 
              k.toLowerCase().includes('link') || 
              k.toLowerCase().includes('profile') ||
              k.toLowerCase().includes('scholar') ||
              k.toLowerCase().includes('google')
            ) || columns.find(k => k.toLowerCase().includes('http') || k.toLowerCase().includes('www')) || ''
            
            console.log('Standard column detection:', { nameKey, deptKey, urlKey })
          }
          
          console.log('Detected keys:', { nameKey, deptKey, urlKey }) // Debug log
          
          const facultyData: FacultyData[] = actualData.map((row, index) => {
            const url = urlKey ? (row[urlKey] || '') : ''
            console.log(`Row ${index}:`, { name: row[nameKey], dept: row[deptKey], url }) // Debug log
            
            return {
              name: row[nameKey] || `Faculty ${index + 1}`,
              department: row[deptKey] || 'Unknown',
              url: url
            }
          })
          
          // Check if we have URLs
          const hasUrls = facultyData.some(f => f.url && f.url.trim() !== '')
          if (!hasUrls) {
            alert('Warning: No Google Scholar URLs found in the uploaded file. Please ensure your Excel file has a column containing Google Scholar profile URLs.')
          }

          setUploadedData(facultyData)
          setShowPreview(true)
        } catch (error) {
          console.error('Error parsing Excel file:', error)
          alert('Error parsing Excel file. Please check the format.')
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  })

  const processMetrics = async () => {
    if (uploadedData.length === 0) return

    setIsProcessing(true)
    const initialMetrics: ScholarMetrics[] = uploadedData.map(faculty => ({
      name: faculty.name,
      department: faculty.department,
      citations: 0,
      hIndex: 0,
      i10Index: 0,
      url: faculty.url,
      status: 'pending'
    }))

    setMetrics(initialMetrics)

    // Process each faculty member
    for (let i = 0; i < uploadedData.length; i++) {
      const faculty = uploadedData[i]
      
      // Update status to processing
      setMetrics(prev => prev.map((m, idx) => 
        idx === i ? { ...m, status: 'processing' } : m
      ))

      try {
        // Call backend API to extract metrics
        const response = await fetch('http://localhost:8000/api/scholar/extract-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: faculty.url })
        })

        if (response.ok) {
          const data = await response.json()
          setMetrics(prev => prev.map((m, idx) => 
            idx === i ? { 
              ...m, 
              citations: data.citations || 0,
              hIndex: data.h_index || 0,
              i10Index: data.i10_index || 0,
              status: 'completed'
            } : m
          ))
          
          // Add a small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          throw new Error('Failed to extract metrics')
        }
      } catch (error) {
        console.error(`Error processing ${faculty.name}:`, error)
        setMetrics(prev => prev.map((m, idx) => 
          idx === i ? { 
            ...m, 
            status: 'error',
            error: 'Failed to extract metrics'
          } : m
        ))
      }

      // Small delay to show processing state
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    setIsProcessing(false)
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(metrics)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Scholar Metrics')
    XLSX.writeFile(workbook, 'scholar_metrics.xlsx')
  }

  const clearData = () => {
    setUploadedData([])
    setMetrics([])
    setShowPreview(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/" className="text-gray-500 hover:text-gray-700 mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">
                Scholar Metrics
              </h1>
              <p className="text-gray-600 mt-1">
                Extract Google Scholar metrics from faculty profiles
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Upload Section */}
        <div className="card mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Faculty Data
          </h3>
                     <p className="text-gray-600 mb-6">
             Upload an Excel file containing faculty information. The file should have columns for:
             <strong> Faculty Name</strong>, <strong>Department</strong>, and <strong>Google Scholar URL</strong>.
           </p>
           <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
             <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ File Format:</h4>
             <div className="text-sm text-blue-700 space-y-1">
               <div>• Your Excel file should have 3 columns: Faculty Name, Department, and Google Scholar URL</div>
               <div>• The system automatically detects column headers even if they have generic names</div>
               <div>• You can use the "faculty list department 2025 - mock.xlsx" file which contains URLs</div>
               <div>• Or download the sample file below to see the correct format</div>
             </div>
             <div className="mt-3">
               <a 
                 href="/sample_scholar_metrics.xlsx" 
                 download
                 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
               >
                 <Download className="h-4 w-4" />
                 Download Sample Excel File
               </a>
             </div>
           </div>
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-primary-600 font-medium">Drop the Excel file here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag and drop an Excel file here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supports .xlsx and .xls files
                </p>
              </div>
            )}
          </div>

          {uploadedData.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <FileSpreadsheet className="h-5 w-5" />
                <span>{uploadedData.length} faculty members loaded</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
                <button
                  onClick={clearData}
                  className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Data Preview */}
        {showPreview && uploadedData.length > 0 && (
          <div className="card mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Data Preview
            </h3>
            
            {/* Debug Info */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Faculty Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Google Scholar URL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uploadedData.map((faculty, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {faculty.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {faculty.department}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <a 
                          href={faculty.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 break-all"
                        >
                          {faculty.url}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Process Button */}
        {uploadedData.length > 0 && (
          <div className="card mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Extract Metrics
                </h3>
                <p className="text-gray-600">
                  Click the button below to extract citation metrics, h-index, and i-10 index from Google Scholar profiles.
                </p>
              </div>
              <button
                onClick={processMetrics}
                disabled={isProcessing}
                className={`btn-primary flex items-center gap-2 ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Extract Metrics
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {metrics.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Extracted Metrics
              </h3>
              <button
                onClick={exportToExcel}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Faculty Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Citations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      H-Index
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      i-10 Index
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metrics.map((metric, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {metric.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.department}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.citations.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.hIndex}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.i10Index}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          metric.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : metric.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : metric.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {metric.status === 'completed' && '✓ Completed'}
                          {metric.status === 'processing' && '⏳ Processing'}
                          {metric.status === 'error' && '✗ Error'}
                          {metric.status === 'pending' && '⏸ Pending'}
                        </span>
                        {metric.error && (
                          <p className="text-xs text-red-600 mt-1">{metric.error}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.filter(m => m.status === 'completed').length}
                </div>
                <div className="text-sm text-blue-600">Completed</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {metrics.filter(m => m.status === 'processing').length}
                </div>
                <div className="text-sm text-yellow-600">Processing</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {metrics.filter(m => m.status === 'error').length}
                </div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.reduce((sum, m) => sum + m.citations, 0).toLocaleString()}
                </div>
                <div className="text-sm text-green-600">Total Citations</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
