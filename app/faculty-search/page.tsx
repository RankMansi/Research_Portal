'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Trash2, Edit, Eye, Filter, X, Upload, FileText, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface Faculty {
  id: string
  name: string
  department: string
  email?: string
  totalPublications?: number
}

interface Publication {
  title: string
  year: number
  journal?: string
  citations: number
}

interface FacultyProfile {
  faculty: Faculty
  totalCitations: number
  totalDocuments: number
  publications: Publication[]
}

export default function FacultySearch() {
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [filteredFaculty, setFilteredFaculty] = useState<Faculty[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')
  const [departments, setDepartments] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<FacultyProfile | null>(null)
  const [newFaculty, setNewFaculty] = useState({ name: '', department: '', email: '', scopusId: '' })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{success: boolean, message: string, imported: number} | null>(null)


  const years = ['all', '2021', '2022', '2023', '2024', '2025']

  useEffect(() => {
    loadFaculty()
  }, [])

  // Scopus module disabled – placeholder UI below

  const loadFaculty = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/faculty')
      const data = await response.json()
      setFaculty(data)
      setFilteredFaculty(data)
      
      // Extract unique departments
      const uniqueDepts = Array.from(new Set(data.map((f: Faculty) => f.department))).filter((dept): dept is string => typeof dept === 'string')
      setDepartments(uniqueDepts)
    } catch (error) {
      console.error('Error loading faculty:', error)
    }
  }

  // Placeholder: loadAllScopusIds removed

  // Placeholder: startScopusScraping removed

  const handleSearch = () => {
    let filtered = faculty.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.department.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (selectedYear !== 'all') {
      // Filter by year would be applied when fetching publications
    }

    if (selectedDept !== 'all') {
      filtered = filtered.filter(f => f.department === selectedDept)
    }

    setFilteredFaculty(filtered)
  }

  const handleAddFaculty = async () => {
    if (!newFaculty.name || !newFaculty.department || !newFaculty.scopusId) {
      alert('Name, Department, and Scopus ID are required')
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFaculty)
      })
      
      if (response.ok) {
        const addedFaculty = await response.json()
        setFaculty([...faculty, addedFaculty])
        setFilteredFaculty([...filteredFaculty, addedFaculty])
        setNewFaculty({ name: '', department: '', email: '', scopusId: '' })
        setShowAddModal(false)
      }
    } catch (error) {
      console.error('Error adding faculty:', error)
    }
  }

  const handleDeleteFaculty = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/faculty/${id}`, { method: 'DELETE' })
      setFaculty(faculty.filter(f => f.id !== id))
      setFilteredFaculty(filteredFaculty.filter(f => f.id !== id))
    } catch (error) {
      console.error('Error deleting faculty:', error)
    }
  }

  const viewProfile = async (faculty: Faculty) => {
    try {
      const response = await fetch(`http://localhost:8000/api/faculty/${faculty.id}/profile`)
      const profile = await response.json()
      setSelectedProfile(profile)
      setShowProfileModal(true)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  // Placeholder: getScopusId removed

  // Placeholder: getPublications removed

  const handleImportFile = (file: File) => {
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.type === 'application/vnd.ms-excel')) {
      setImportFile(file)
      setImportResult(null)
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)')
    }
  }

  const handleImportPublications = async () => {
    if (!importFile) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('http://localhost:8000/api/faculty/import-publications', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      setImportResult(result)

      if (result.success) {
        // Reload faculty data to show updated publication counts
        await loadFaculty()
        setShowImportModal(false)
        setImportFile(null)
      }
    } catch (error) {
      console.error('Error importing publications:', error)
      setImportResult({
        success: false,
        message: 'Failed to import publications. Please try again.',
        imported: 0
      })
    } finally {
      setIsImporting(false)
    }
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
                Faculty Search
              </h1>
              <p className="text-gray-600 mt-1">
                Search faculty members and view their research profiles
              </p>
            </div>
                         <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import Publications
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Faculty
                </button>
              </div>
          </div>
        </div>
      </header>

             {/* Main Content */}
       <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
         {/* Scopus placeholder */}
         <div className="card mb-8">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-xl font-semibold text-gray-900">Scopus Module</h3>
           </div>
           <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded text-gray-600">
             Placeholder: Scopus UI is disabled. New logic will be added here.
             </div>
         </div>

         {/* Search and Filters */}
        <div className="card mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search faculty by name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="input-field"
            >
              {years.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years' : year}
                </option>
              ))}
            </select>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="input-field"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSearch} className="btn-primary">
              Search
            </button>
          </div>
        </div>

        {/* Faculty List */}
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Faculty Members ({filteredFaculty.length})
          </h3>
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
                    Total Publications
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFaculty.map((faculty) => (
                  <tr key={faculty.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{faculty.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{faculty.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {faculty.totalPublications || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{faculty.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => viewProfile(faculty)}
                          className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        {/* Scopus actions removed; placeholder to be re-added with new logic */}
                        <button
                          onClick={() => handleDeleteFaculty(faculty.id)}
                          className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Faculty Member</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newFaculty.name}
                  onChange={(e) => setNewFaculty({...newFaculty, name: e.target.value})}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Department"
                  value={newFaculty.department}
                  onChange={(e) => setNewFaculty({...newFaculty, department: e.target.value})}
                  className="input-field"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newFaculty.email}
                  onChange={(e) => setNewFaculty({...newFaculty, email: e.target.value})}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Scopus ID (required)"
                  value={newFaculty.scopusId}
                  onChange={(e) => setNewFaculty({...newFaculty, scopusId: e.target.value})}
                  className="input-field"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFaculty}
                  className="btn-primary"
                >
                  Add Faculty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Faculty Profile Modal */}
      {showProfileModal && selectedProfile && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-gray-900">
                {selectedProfile.faculty.name} - {selectedProfile.faculty.department}
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{selectedProfile.totalCitations}</div>
                <div className="text-sm text-blue-600">Total Citations</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{selectedProfile.totalDocuments}</div>
                <div className="text-sm text-green-600">Total Documents</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedProfile.publications.length}
                </div>
                <div className="text-sm text-purple-600">Publications</div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Publications by Year</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedProfile.publications
                  .sort((a, b) => b.year - a.year)
                  .map((pub, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="font-medium text-gray-900">{pub.title}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {pub.journal} • {pub.year} • {pub.citations} citations
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Publications Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Publications Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload the merged publications Excel file from Scopus+WoS integration to update faculty publication counts.
              </p>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => e.target.files && handleImportFile(e.target.files[0])}
                    className="hidden"
                    id="import-file"
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {importFile ? importFile.name : 'Click to select Excel file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports .xlsx and .xls files
                    </p>
                  </label>
                </div>

                {importResult && (
                  <div className={`p-3 rounded-lg ${
                    importResult.success 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <p className="text-sm">{importResult.message}</p>
                    {importResult.success && (
                      <p className="text-xs mt-1">
                        Successfully imported data for {importResult.imported} faculty members
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                    setImportResult(null)
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportPublications}
                  disabled={!importFile || isImporting}
                  className={`btn-primary ${!importFile || isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isImporting ? 'Importing...' : 'Import Publications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
