'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TicketCardPro from './TicketCardPro';
import type { FullTicket } from '@/lib/supabase';
import { 
  SearchX, 
  Train, 
  Users, 
  AlertCircle,
  Sparkles,
  Clock,
  CheckCircle
} from 'lucide-react';

interface SearchResultsProProps {
  results: FullTicket[];
  isLoading: boolean;
  hasSearched: boolean;
  error?: string | null;
}

export default function SearchResultsPro({ results, isLoading, hasSearched, error }: SearchResultsProProps) {
  // Loading state with skeletons
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary animate-pulse" />
              <CardTitle>Searching tickets...</CardTitle>
            </div>
            <CardDescription>
              Please wait while we search through the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Loading skeletons */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Search Error</span>
          </CardTitle>
          <CardDescription>
            We encountered an issue while searching for tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="mb-2">Try these solutions:</p>
            <ul className="space-y-1 ml-4">
              <li>• Check your internet connection</li>
              <li>• Verify the PNR number format (10 digits)</li>
              <li>• Try a different search criteria</li>
              <li>• Refresh the page and try again</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No search performed yet
  if (!hasSearched) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Train className="h-5 w-5 text-primary" />
            <span>Ready to Search</span>
          </CardTitle>
          <CardDescription>
            Enter your search criteria to find train tickets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Train className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Search Train Tickets</h3>
            <p className="text-muted-foreground mb-4">
              Use the search form to find tickets by PNR number, passenger name, or other criteria.
            </p>
            
            {/* Quick search examples */}
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Popular Searches</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>PNR Search:</span>
                  <code className="bg-background px-1 rounded">2341068596</code>
                </div>
                <div className="flex justify-between">
                  <span>Passenger Name:</span>
                  <code className="bg-background px-1 rounded">HITESH</code>
                </div>
                <div className="flex justify-between">
                  <span>Train Number:</span>
                  <code className="bg-background px-1 rounded">12345</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No results found
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SearchX className="h-5 w-5 text-muted-foreground" />
            <span>No Tickets Found</span>
          </CardTitle>
          <CardDescription>
            We couldn't find any tickets matching your search criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Results</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria or check for typos.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Suggestions:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Double-check the PNR number for accuracy</li>
              <li>• Try searching with just a passenger's first name</li>
              <li>• Use the advanced search with fewer criteria</li>
              <li>• Ensure the ticket has been processed and uploaded</li>
              <li>• Try searching by train number instead</li>
            </ul>
          </div>
        </CardContent>
      </Card>
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
    <div className="space-y-4">
      {/* Results Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Search Results</span>
              </CardTitle>
              <CardDescription>
                Found {results.length} ticket{results.length !== 1 ? 's' : ''} matching your criteria
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Train className="w-3 h-3" />
                <span>{results.length} Ticket{results.length !== 1 ? 's' : ''}</span>
              </Badge>
              {totalPassengers > 0 && (
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span>{totalPassengers} Passenger{totalPassengers !== 1 ? 's' : ''}</span>
                </Badge>
              )}
              {totalJourneys > 0 && (
                <Badge variant="outline">
                  {totalJourneys} Journey{totalJourneys !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((ticket) => (
          <TicketCardPro key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {/* Pagination hint for large results */}
      {results.length >= 50 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Showing first {results.length} results. Use more specific search criteria for refined results.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance indicator */}
      <div className="text-center">
        <Badge variant="outline" className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          Powered by 1000% Accuracy Processing
        </Badge>
      </div>
    </div>
  );
}