'use client'

import { useState } from 'react'
import { Upload, Download, FileText, Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface ProcessingResult {
  success: boolean
  message: string
  download_url?: string
  stats?: {
    total_faculty: number
    combined_publications: number
    departments: number
    processing_time: string
  }
  error?: string
}

export default function ScopusWosIntegration() {
  const [scopusFile, setScopusFile] = useState<File | null>(null)
  const [wosFile, setWosFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [scopusDragActive, setScopusDragActive] = useState(false)
  const [wosDragActive, setWosDragActive] = useState(false)

  const handleScopusFileSelect = (selectedFile: File) => {
    if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        selectedFile.type === 'application/vnd.ms-excel')) {
      setScopusFile(selectedFile)
      setResult(null)
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)')
    }
  }

  const handleWosFileSelect = (selectedFile: File) => {
    if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        selectedFile.type === 'application/vnd.ms-excel')) {
      setWosFile(selectedFile)
      setResult(null)
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)')
    }
  }

  const handleScopusDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setScopusDragActive(true)
    } else if (e.type === 'dragleave') {
      setScopusDragActive(false)
    }
  }

  const handleWosDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setWosDragActive(true)
    } else if (e.type === 'dragleave') {
      setWosDragActive(false)
    }
  }

  const handleScopusDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setScopusDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleScopusFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleWosDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setWosDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleWosFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleScopusFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleScopusFileSelect(e.target.files[0])
    }
  }

  const handleWosFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleWosFileSelect(e.target.files[0])
    }
  }

  const handleProcess = async () => {
    if (!scopusFile || !wosFile || isProcessing) return

    setIsProcessing(true)
    setResult(null)

    try {
      // First test CORS connection
      console.log('Testing CORS connection...')
      const corsTest = await fetch('http://localhost:8000/api/test-cors')
      if (!corsTest.ok) {
        throw new Error(`CORS test failed: ${corsTest.status}`)
      }
      console.log('CORS test passed')

      const formData = new FormData()
      formData.append('scopus_file', scopusFile)
      formData.append('wos_file', wosFile)

      console.log('Sending files to backend...')
      const response = await fetch('http://localhost:8000/api/scopus-wos/merge-process', {
        method: 'POST',
        body: formData
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Response data:', data)
      setResult(data)
    } catch (error) {
      console.error('Error processing files:', error)
      setResult({
        success: false,
        message: 'Failed to process the files. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadSampleFile = () => {
    // Create a sample Excel file for download
    const sampleData = [
      ['FacultyName', 'Department', 'SCOPUS_ID', 'WOS_ID'],
      ['Aarti Solanki', 'Information and Communication Technology', 'NA', 'KMY0295202'],
      ['Aashka Raval', 'Department of Computer Science', '57983472000', 'KMY-0232-202'],
      ['ABHIJIT RAY', 'Solar Energy', '5671902420', 'E-7350-2014'],
      ['Abhinav Kumar', 'Petroleum Engineering', '57208201440', 'AEJ-8976-202']
    ]

    // Convert to CSV for now (in a real app, you'd generate actual Excel)
    const csvContent = sampleData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_faculty_list.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Scopus+WoS Integration
              </h1>
              <p className="text-gray-600 mt-1">
                Upload separate Scopus and WoS Excel files to merge and deduplicate publications
              </p>
            </div>
            <nav className="flex space-x-4">
              <Link 
                href="/" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Instructions */}
        <div className="card mb-8">
          <div className="flex items-start space-x-3">
            <FileText className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How to Use This Tool
              </h3>
              <div className="space-y-2 text-gray-600">
                <p>1. Prepare two separate Excel files from Scopus and WoS exports:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Scopus File:</strong> Excel export from Scopus with columns like Sr.no, Authors, Author full names, Title, Year, Source title, etc.</li>
                  <li><strong>WoS File:</strong> Excel export from Web of Science with similar structure</li>
                </ul>
                <p>2. The system will automatically extract:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Author names</strong> from "Author full names" or "Authors" columns</li>
                  <li><strong>Publication titles</strong> from "Title" column</li>
                  <li><strong>Years</strong> from "Year" column (if available)</li>
                  <li><strong>Note:</strong> Only titles and years will be displayed (no journal/source information)</li>
                </ul>
                <p>3. Upload both files using the form below</p>
                <p>4. The system will merge, deduplicate, and filter out inflation entries (hyphens, symbols, etc.)</p>
                <p>5. Multiple authors in one publication will be automatically split into separate professor entries</p>
                <p>6. Download the processed results with unique publications per author in formatted Excel layout</p>
              </div>
              <button
                onClick={downloadSampleFile}
                className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sample File
              </button>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Upload Publication Data Files
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scopus File Upload */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Scopus Publications File</h4>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  scopusDragActive 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleScopusDrag}
                onDragLeave={handleScopusDrag}
                onDragOver={handleScopusDrag}
                onDrop={handleScopusDrop}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleScopusFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                
                <div className="space-y-3">
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {scopusFile ? scopusFile.name : 'Drop Scopus file here or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports .xlsx and .xls files
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* WoS File Upload */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">WoS Publications File</h4>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  wosDragActive 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleWosDrag}
                onDragLeave={handleWosDrag}
                onDragOver={handleWosDrag}
                onDrop={handleWosDrop}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleWosFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                
                <div className="space-y-3">
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {wosFile ? wosFile.name : 'Drop WoS file here or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports .xlsx and .xls files
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Process Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleProcess}
              disabled={!scopusFile || !wosFile || isProcessing}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                !scopusFile || !wosFile || isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                  Processing...
                </>
              ) : (
                <>
                  <Database className="h-5 w-5 mr-2" />
                  Merge & Deduplicate Publications
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="card mt-8">
            <div className="flex items-start space-x-3">
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600 mt-1" />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {result.success ? 'Processing Complete!' : 'Processing Failed'}
                </h3>
                
                <p className={`text-sm mb-4 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </p>

                {result.success && result.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-blue-600">Total Authors</p>
                      <p className="text-2xl font-bold text-blue-900">{result.stats.total_faculty}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-green-600">Unique Publications</p>
                      <p className="text-2xl font-bold text-green-900">{result.stats.combined_publications}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-purple-600">Departments</p>
                      <p className="text-2xl font-bold text-purple-900">{result.stats.departments}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-orange-600">Processing Time</p>
                      <p className="text-lg font-bold text-orange-900">{result.stats.processing_time}</p>
                    </div>
                  </div>
                )}

                {result.success && result.download_url && (
                  <div className="flex space-x-4">
                    <a
                      href={`http://localhost:8000${result.download_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Results
                    </a>
                    <button
                      onClick={() => {
                        setScopusFile(null)
                        setWosFile(null)
                        setResult(null)
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Process Another File
                    </button>
                  </div>
                )}

                {result.error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700">
                      <strong>Error Details:</strong> {result.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Information Notice */}
        <div className="card mt-8 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Publication Deduplication Features
              </h3>
              <p className="text-blue-700 text-sm">
                This tool automatically handles common issues in publication data:
              </p>
              <ul className="list-disc list-inside mt-2 text-sm text-blue-700 space-y-1">
                <li><strong>Case-insensitive matching:</strong> "AI in healthcare" and "AI in Healthcare" are treated as the same publication</li>
                <li><strong>Advanced inflation detection:</strong> Removes entries with hyphens (-), dashes (—), underscores (_), bullet points (•), punctuation-only entries, and other symbols used to inflate counts</li>
                <li><strong>Smart column mapping:</strong> Automatically detects and extracts data from "Author full names", "Title", "Year", and "Source title" columns</li>
                <li><strong>Cross-source deduplication:</strong> Removes duplicates across Scopus and WoS data for the same author</li>
                <li><strong>Individual professor entries:</strong> Each professor gets their own separate row with all their publications listed as numbered list in single cell. Multiple authors in one publication are automatically split into separate entries.</li>
                <li><strong>Publication titles:</strong> Displays publication titles with years (no journal/source information)</li>
                <li><strong>Meaningful content filtering:</strong> Filters out entries that are too short or contain only numbers and symbols</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
