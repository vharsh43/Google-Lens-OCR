'use client';

import { AlertCircle, Train, Users } from 'lucide-react';
import TicketCard from './TicketCard';
import type { FullTicket } from '@/lib/supabase';

interface SearchResultsProps {
  results: FullTicket[];
  isLoading: boolean;
  hasSearched: boolean;
  error?: string | null;
}

export default function SearchResults({ results, isLoading, hasSearched, error }: SearchResultsProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Searching tickets...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-6 w-6" />
          <div>
            <h3 className="font-medium">Search Error</h3>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No search performed yet
  if (!hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <Train className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Search for Train Tickets</h3>
        <p className="text-gray-500">
          Enter a PNR number, passenger name, or use advanced search to find tickets.
        </p>
      </div>
    );
  }

  // No results found
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.1-5.535-2.709M15 17a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Tickets Found</h3>
        <p className="text-gray-500 mb-4">
          We couldn&apos;t find any tickets matching your search criteria.
        </p>
        <div className="text-sm text-gray-600">
          <p className="mb-2">Try:</p>
          <ul className="text-left inline-block space-y-1">
            <li>• Checking the PNR number for typos</li>
            <li>• Using a partial passenger name</li>
            <li>• Expanding your date range</li>
            <li>• Using different search criteria</li>
          </ul>
        </div>
      </div>
    );
  }

  // Results found
  const totalPassengers = results.reduce((total, ticket) => {
    return total + (ticket.passengers?.length || 0);
  }, 0);

  const totalJourneys = results.reduce((total, ticket) => {
    return total + (ticket.journeys?.length || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Search Results</h2>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Train className="h-4 w-4" />
              {results.length} ticket{results.length !== 1 ? 's' : ''}
            </div>
            {totalPassengers > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {totalPassengers} passenger{totalPassengers !== 1 ? 's' : ''}
              </div>
            )}
            {totalJourneys > 0 && (
              <div className="text-sm">
                {totalJourneys} journey{totalJourneys !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {/* Pagination hint for future */}
      {results.length >= 50 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800 text-sm">
            Showing first {results.length} results. Use more specific search criteria for better results.
          </p>
        </div>
      )}
    </div>
  );
}