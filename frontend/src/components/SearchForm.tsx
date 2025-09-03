'use client';

import { useState } from 'react';
import { Search, Train, User, Calendar } from 'lucide-react';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export interface SearchParams {
  pnr?: string;
  passengerName?: string;
  trainNumber?: string;
  fromDate?: string;
  toDate?: string;
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [searchType, setSearchType] = useState<'pnr' | 'passenger' | 'advanced'>('pnr');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one search parameter is provided
    const hasSearchTerm = searchParams.pnr || 
                         searchParams.passengerName || 
                         searchParams.trainNumber;
    
    if (!hasSearchTerm) {
      alert('Please enter at least one search criteria');
      return;
    }

    onSearch(searchParams);
  };

  const handleInputChange = (field: keyof SearchParams, value: string) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const clearForm = () => {
    setSearchParams({});
    setSearchType('pnr');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Search className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">Search Train Tickets</h2>
      </div>

      {/* Search Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSearchType('pnr')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            searchType === 'pnr' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Search className="h-4 w-4" />
          PNR Search
        </button>
        <button
          type="button"
          onClick={() => setSearchType('passenger')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            searchType === 'passenger' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <User className="h-4 w-4" />
          Passenger Search
        </button>
        <button
          type="button"
          onClick={() => setSearchType('advanced')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            searchType === 'advanced' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Train className="h-4 w-4" />
          Advanced Search
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* PNR Search */}
        {(searchType === 'pnr' || searchType === 'advanced') && (
          <div>
            <label htmlFor="pnr" className="block text-sm font-medium text-gray-700 mb-2">
              PNR Number
            </label>
            <input
              type="text"
              id="pnr"
              value={searchParams.pnr || ''}
              onChange={(e) => handleInputChange('pnr', e.target.value)}
              placeholder="Enter 10-digit PNR (e.g., 2341068596)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={10}
            />
          </div>
        )}

        {/* Passenger Search */}
        {(searchType === 'passenger' || searchType === 'advanced') && (
          <div>
            <label htmlFor="passengerName" className="block text-sm font-medium text-gray-700 mb-2">
              Passenger Name
            </label>
            <input
              type="text"
              id="passengerName"
              value={searchParams.passengerName || ''}
              onChange={(e) => handleInputChange('passengerName', e.target.value)}
              placeholder="Enter passenger name (e.g., HITESH)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Advanced Search Fields */}
        {searchType === 'advanced' && (
          <>
            <div>
              <label htmlFor="trainNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Train Number
              </label>
              <input
                type="text"
                id="trainNumber"
                value={searchParams.trainNumber || ''}
                onChange={(e) => handleInputChange('trainNumber', e.target.value)}
                placeholder="Enter train number (e.g., 20958)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  id="fromDate"
                  value={searchParams.fromDate || ''}
                  onChange={(e) => handleInputChange('fromDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="toDate" className="block text-sm font-medium text-gray-700 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  id="toDate"
                  value={searchParams.toDate || ''}
                  onChange={(e) => handleInputChange('toDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isLoading ? 'Searching...' : 'Search Tickets'}
          </button>
          <button
            type="button"
            onClick={clearForm}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Search Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Search Tips:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• PNR numbers are 10 digits long</li>
          <li>• Passenger names are case-insensitive</li>
          <li>• Use partial names for broader search results</li>
          <li>• Advanced search allows combining multiple criteria</li>
        </ul>
      </div>
    </div>
  );
}