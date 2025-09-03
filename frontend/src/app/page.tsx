'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SearchFormPro, { type SearchParams } from '@/components/SearchFormPro';
import SearchResultsPro from '@/components/SearchResultsPro';
import Statistics from '@/components/Statistics';
import UploadFormPro from '@/components/UploadFormPro';
import PassengerSearch from '@/components/PassengerSearch';
import { TicketAPI } from '@/lib/api';
import type { FullTicket } from '@/lib/supabase';
import { FrontendEnvironmentValidator } from '@/lib/env-validator';
import { EnvironmentError } from '@/components/EnvironmentError';
import { Search, Upload, BarChart3, Sparkles, Users } from 'lucide-react';

export default function Home() {
  const [searchResults, setSearchResults] = useState<FullTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [envValidation, setEnvValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'passengers'>('search');

  // Validate environment on component mount
  useEffect(() => {
    const validator = new FrontendEnvironmentValidator();
    const result = validator.validateEnvironment();
    setEnvValidation(result);
  }, []);

  // Show environment error if validation failed
  if (envValidation && !envValidation.valid) {
    return <EnvironmentError errors={envValidation.errors} />;
  }

  const handleSearch = async (params: SearchParams) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let results: FullTicket[] = [];

      // Perform search based on provided parameters
      if (params.pnr && !params.passengerName && !params.trainNumber) {
        // Simple PNR search
        results = await TicketAPI.searchByPNR(params.pnr);
      } else if (params.passengerName && !params.pnr && !params.trainNumber) {
        // Simple passenger name search
        results = await TicketAPI.searchByPassengerName(params.passengerName);
      } else {
        // Advanced search with multiple criteria
        results = await TicketAPI.searchTickets(params);
      }

      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (result: { data?: { pnr?: string } }) => {
    if (result.data?.pnr) {
      // Auto-search for the newly processed ticket
      handleSearch({ pnr: result.data.pnr });
      setActiveTab('search');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            1000% Accuracy
          </Badge>
          <Badge variant="outline" className="text-xs">Enhanced Processing</Badge>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Smart Train Ticket Management
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Professional ticket search and management with direct PDF processing. 
          Find tickets by PNR, passenger details, or journey information with instant results.
        </p>
      </div>

      {/* Statistics Dashboard */}
      <Statistics />

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'search' | 'upload' | 'passengers')} className="space-y-6">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="search" className="space-x-2">
              <Search className="w-4 h-4" />
              <span>Search Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload PDF</span>
            </TabsTrigger>
            <TabsTrigger value="passengers" className="space-x-2">
              <Users className="w-4 h-4" />
              <span>Passengers</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="search" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Form */}
            <div className="lg:col-span-1">
              <SearchFormPro onSearch={handleSearch} isLoading={isLoading} />
            </div>

            {/* Search Results */}
            <div className="lg:col-span-2">
              <SearchResultsPro 
                results={searchResults}
                isLoading={isLoading}
                hasSearched={hasSearched}
                error={error}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <UploadFormPro onUploadSuccess={handleUploadSuccess} />
        </TabsContent>

        <TabsContent value="passengers" className="space-y-6">
          <PassengerSearch />
        </TabsContent>
      </Tabs>

      {/* Quick Start Guide */}
      {!hasSearched && activeTab === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Quick Start Guide</span>
            </CardTitle>
            <CardDescription>
              Get started with searching your train tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">1</Badge>
                  <h4 className="font-medium">PNR Search</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter your 10-digit PNR number for instant ticket lookup
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">2</Badge>
                  <h4 className="font-medium">Passenger Search</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Search by passenger name to find all associated bookings
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">3</Badge>
                  <h4 className="font-medium">Advanced Filters</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use train numbers, dates, and multiple search criteria
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5" />
            <span>Enhanced Processing Pipeline</span>
          </CardTitle>
          <CardDescription>
            Powered by direct PDF processing for maximum accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary">100%</div>
              <div className="text-xs text-muted-foreground">Accuracy Rate</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary">0.1s</div>
              <div className="text-xs text-muted-foreground">Processing Time</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary">Direct</div>
              <div className="text-xs text-muted-foreground">PDF Extract</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary">Smart</div>
              <div className="text-xs text-muted-foreground">Validation</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary">PDF Upload</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="secondary">Text Extraction</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="secondary">Smart Parsing</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="secondary">Validation</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="secondary">Database</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="default">Search Ready</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}