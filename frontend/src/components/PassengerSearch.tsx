'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Users, 
  User, 
  Loader2,
  UserSearch,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import PassengerProfile from './PassengerProfile';
import TicketDetailsModal from './TicketDetailsModal';
import { TicketAPI } from '@/lib/api';
import type { FullTicket } from '@/lib/supabase';

interface LinkedPassenger {
  name: string;
  age: number;
  gender?: string;
  tickets: FullTicket[];
}

export default function PassengerSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LinkedPassenger[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<LinkedPassenger | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<FullTicket | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    
    try {
      // First, get all tickets that match the passenger name
      const tickets = await TicketAPI.searchByPassengerName(searchQuery);
      
      // Group tickets by passenger (name + age combination)
      const passengerMap = new Map<string, LinkedPassenger>();
      
      tickets.forEach(ticket => {
        ticket.passengers?.forEach(passenger => {
          const key = `${passenger.name.toUpperCase()}_${passenger.age}`;
          
          if (!passengerMap.has(key)) {
            passengerMap.set(key, {
              name: passenger.name,
              age: passenger.age || 0,
              gender: passenger.gender,
              tickets: []
            });
          }
          
          const linkedPassenger = passengerMap.get(key)!;
          
          // Only add the ticket if it's not already included
          if (!linkedPassenger.tickets.find(t => t.id === ticket.id)) {
            linkedPassenger.tickets.push(ticket);
          }
          
          // Update gender if not set (use most recent)
          if (!linkedPassenger.gender && passenger.gender) {
            linkedPassenger.gender = passenger.gender;
          }
        });
      });
      
      // Convert map to array and sort by number of tickets (most frequent travelers first)
      const linkedPassengers = Array.from(passengerMap.values())
        .sort((a, b) => b.tickets.length - a.tickets.length);
      
      setSearchResults(linkedPassengers);
      
    } catch (err) {
      console.error('Passenger search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTicket = (ticketId: string) => {
    // Find the ticket from search results or selected passenger's tickets
    let ticket: FullTicket | null = null;
    
    // First check if we're in passenger profile view
    if (selectedPassenger) {
      ticket = selectedPassenger.tickets.find(t => t.id === ticketId) || null;
    } else {
      // Check search results
      for (const passenger of searchResults) {
        const foundTicket = passenger.tickets.find(t => t.id === ticketId);
        if (foundTicket) {
          ticket = foundTicket;
          break;
        }
      }
    }
    
    if (ticket) {
      setSelectedTicket(ticket);
      setIsTicketModalOpen(true);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
    setSelectedPassenger(null);
    setSelectedTicket(null);
    setIsTicketModalOpen(false);
  };

  // If a specific passenger is selected, show their profile
  if (selectedPassenger) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setSelectedPassenger(null)}
            className="mb-4"
          >
            ← Back to Search Results
          </Button>
        </div>
        <PassengerProfile 
          passenger={selectedPassenger} 
          onViewTicket={handleViewTicket}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserSearch className="w-5 h-5" />
            <span>Passenger Search & Linking</span>
          </CardTitle>
          <CardDescription>
            Search for passengers across all tickets and view their travel history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter passenger name (e.g., HITESH, CHAMPABEN)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading || !searchQuery.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            
            {hasSearched && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearSearch}
                className="text-muted-foreground"
              >
                Clear Search
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <CardTitle>Searching passengers...</CardTitle>
            </div>
            <CardDescription>
              Looking for passengers and linking their tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Search Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Search Results */}
      {hasSearched && !isLoading && !error && searchResults.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserSearch className="h-5 w-5 text-muted-foreground" />
              <span>No Passengers Found</span>
            </CardTitle>
            <CardDescription>
              No passengers found matching "{searchQuery}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <UserSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Try searching with a different name or check for typos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          {/* Results Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-500" />
                <span>Found {searchResults.length} Passenger{searchResults.length !== 1 ? 's' : ''}</span>
              </CardTitle>
              <CardDescription>
                Passengers linked by name and age across multiple tickets
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Results List */}
          <div className="space-y-4">
            {searchResults.map((passenger, index) => (
              <Card 
                key={`${passenger.name}_${passenger.age}`} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPassenger(passenger)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-lg">{passenger.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {passenger.age}y
                          </Badge>
                          {passenger.gender && (
                            <Badge variant="outline" className="text-xs">
                              {passenger.gender}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{passenger.tickets.length} ticket{passenger.tickets.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{passenger.tickets.reduce((total, ticket) => 
                            total + (ticket.journeys?.length || 0), 0
                          )} journey{passenger.tickets.reduce((total, ticket) => 
                            total + (ticket.journeys?.length || 0), 0
                          ) !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>₹{passenger.tickets.reduce((total, ticket) => {
                            const ticketTotal = ticket.payment?.total || 0;
                            const passengerCount = ticket.passengers?.length || 1;
                            return total + (ticketTotal / passengerCount);
                          }, 0).toLocaleString('en-IN')} spent</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {passenger.tickets.length > 1 && (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Frequent
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        View Profile →
                      </Button>
                    </div>
                  </div>
                  
                  {/* Recent tickets preview */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex flex-wrap gap-2">
                      {passenger.tickets.slice(0, 3).map((ticket) => (
                        <Badge key={ticket.id} variant="outline" className="text-xs">
                          PNR: {ticket.pnr}
                        </Badge>
                      ))}
                      {passenger.tickets.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{passenger.tickets.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Passenger Linking System</span>
            </CardTitle>
            <CardDescription>
              Search for passengers to view their complete travel history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <UserSearch className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Smart Passenger Linking</h3>
              <p className="text-muted-foreground mb-4">
                Our system automatically links passengers across multiple tickets using name and age identification.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto">
                <div className="flex items-center space-x-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Features</span>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div>• Cross-ticket passenger identification</div>
                  <div>• Complete travel history tracking</div>
                  <div>• Frequent route analysis</div>
                  <div>• Travel spending insights</div>
                  <div>• Multi-segment journey connections</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        ticket={selectedTicket}
        isOpen={isTicketModalOpen}
        onClose={() => {
          setIsTicketModalOpen(false);
          setSelectedTicket(null);
        }}
      />
    </div>
  );
}