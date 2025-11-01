'use client'

import { useState } from 'react'

export default function MergePublications() {
  const [file, setFile] = useState<File | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleUpload = async () => {
    if (!file || isRunning) return

    setIsRunning(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)

      const resp = await fetch('http://localhost:8000/api/merge/upload-run', {
        method: 'POST',
        body: form
      })
      if (!resp.ok) throw new Error('Failed to run pipeline')
      const data = await resp.json()
      setResult(data)
    } catch (e) {
      console.error(e)
      alert('Failed to process the file. Please try again.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Merge Publications</h1>
              <p className="text-gray-600 mt-1">Upload Excel (Author + IDs), merge Scopus + WoS, download clean output.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="card">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Input Excel</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!file || isRunning}
                className={`btn-primary ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRunning ? 'Processing...' : 'Run Merge'}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="card mt-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Result</h3>
            <div className="space-y-2 text-gray-700">
              <div>Authors processed: {result.authors}</div>
              <div>Duplicates logged: {result.duplicates_logged}</div>
              <div className="mt-4">
                <a
                  href={`http://localhost:8000${result.download_url}`}
                  target="_blank"
                  className="btn-secondary"
                >
                  Download Output Excel
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


