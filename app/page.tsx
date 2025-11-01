'use client'

import Link from 'next/link'

export default function Dashboard() {

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Faculty Publications Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                University Research & Publications Tracking System
              </p>
            </div>
            <nav className="flex space-x-8">
              <Link 
                href="/faculty-search" 
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Faculty Search
              </Link>
              <Link 
                href="/scopus-wos-integration" 
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Scopus+WoS Integration
              </Link>
              <Link 
                href="/scholar-metrics" 
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Scholar Metrics
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to the Research Dashboard
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Track faculty publications, citations, and research metrics across all departments. 
            Get insights into research productivity and academic impact.
          </p>
        </div>


        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Faculty Search
            </h3>
            <p className="text-gray-600 mb-6">
              Search faculty members, view profiles, and import publication data from merged Excel files. 
              See publication counts and department information.
            </p>
            <Link href="/faculty-search" className="btn-primary inline-block">
              Explore Faculty
            </Link>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Scopus+WoS Integration
            </h3>
            <p className="text-gray-600 mb-6">
              Upload separate Scopus and WoS Excel files to merge, deduplicate, and create unique publication lists. 
              Advanced inflation detection and cross-source deduplication.
            </p>
            <Link href="/scopus-wos-integration" className="btn-primary inline-block">
              Merge Publications
            </Link>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Scholar Metrics & Analytics
            </h3>
            <p className="text-gray-600 mb-6">
              Upload faculty data, extract citation metrics, h-index, and i-10 index from Google Scholar profiles. 
              Generate comprehensive research analytics.
            </p>
            <Link href="/scholar-metrics" className="btn-primary inline-block">
              View Metrics
            </Link>
          </div>
        </div>



      </main>
    </div>
  )
}
