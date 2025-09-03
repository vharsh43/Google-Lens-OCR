'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Search, 
  Loader2, 
  User, 
  Hash, 
  Train, 
  Calendar,
  Filter,
  X,
  Sparkles
} from 'lucide-react';

export interface SearchParams {
  pnr?: string;
  passengerName?: string;
  trainNumber?: string;
  fromDate?: string;
  toDate?: string;
}

interface SearchFormProProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export default function SearchFormPro({ onSearch, isLoading }: SearchFormProProps) {
  const [searchType, setSearchType] = useState<'pnr' | 'passenger' | 'advanced'>('pnr');
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty values
    const filteredParams = Object.entries(searchParams).reduce((acc, [key, value]) => {
      if (value && value.trim()) {
        acc[key as keyof SearchParams] = value.trim();
      }
      return acc;
    }, {} as SearchParams);

    onSearch(filteredParams);
  };

  const handleInputChange = (field: keyof SearchParams, value: string) => {
    const newParams = { ...searchParams, [field]: value };
    setSearchParams(newParams);
    
    // Check if we have active filters
    const hasFilters = Object.values(newParams).some(v => v && v.trim());
    setHasActiveFilters(hasFilters);
  };

  const clearSearch = () => {
    setSearchParams({});
    setHasActiveFilters(false);
    setSearchType('pnr');
  };

  const getSearchTypeBadge = () => {
    switch (searchType) {
      case 'pnr':
        return <Badge variant="default" className="text-xs"><Hash className="w-3 h-3 mr-1" />PNR Search</Badge>;
      case 'passenger':
        return <Badge variant="secondary" className="text-xs"><User className="w-3 h-3 mr-1" />Passenger</Badge>;
      case 'advanced':
        return <Badge variant="outline" className="text-xs"><Filter className="w-3 h-3 mr-1" />Advanced</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5" />
              <span>Search Tickets</span>
            </CardTitle>
            <CardDescription>
              Find tickets by PNR, passenger name, or advanced filters
            </CardDescription>
          </div>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearSearch}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Type Selector */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={searchType === 'pnr' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchType('pnr')}
            className="flex items-center space-x-1"
          >
            <Hash className="w-3 h-3" />
            <span>PNR</span>
          </Button>
          <Button
            variant={searchType === 'passenger' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchType('passenger')}
            className="flex items-center space-x-1"
          >
            <User className="w-3 h-3" />
            <span>Passenger</span>
          </Button>
          <Button
            variant={searchType === 'advanced' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchType('advanced')}
            className="flex items-center space-x-1"
          >
            <Filter className="w-3 h-3" />
            <span>Advanced</span>
          </Button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          {/* PNR Search */}
          {searchType === 'pnr' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">PNR Number</label>
              <Input
                placeholder="Enter 10-digit PNR number"
                value={searchParams.pnr || ''}
                onChange={(e) => handleInputChange('pnr', e.target.value)}
                maxLength={10}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Example: 2341068596
              </p>
            </div>
          )}

          {/* Passenger Search */}
          {searchType === 'passenger' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Passenger Name</label>
              <Input
                placeholder="Enter passenger name"
                value={searchParams.passengerName || ''}
                onChange={(e) => handleInputChange('passengerName', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Search by full or partial name (e.g., "HITESH" or "CHAMPABEN")
              </p>
            </div>
          )}

          {/* Advanced Search */}
          {searchType === 'advanced' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">PNR Number</label>
                  <Input
                    placeholder="10-digit PNR"
                    value={searchParams.pnr || ''}
                    onChange={(e) => handleInputChange('pnr', e.target.value)}
                    maxLength={10}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Passenger Name</label>
                  <Input
                    placeholder="Passenger name"
                    value={searchParams.passengerName || ''}
                    onChange={(e) => handleInputChange('passengerName', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Train Number</label>
                  <Input
                    placeholder="e.g., 12345"
                    value={searchParams.trainNumber || ''}
                    onChange={(e) => handleInputChange('trainNumber', e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Journey Date</label>
                  <Input
                    type="date"
                    value={searchParams.fromDate || ''}
                    onChange={(e) => handleInputChange('fromDate', e.target.value)}
                  />
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="more-filters" className="border-none">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                    More Filters
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date Range End</label>
                      <Input
                        type="date"
                        value={searchParams.toDate || ''}
                        onChange={(e) => handleInputChange('toDate', e.target.value)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          <Separator />

          {/* Search Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !hasActiveFilters}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Tickets
              </>
            )}
          </Button>

          {/* Quick Tips */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Search Tips</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• PNR search provides the most accurate results</p>
              <p>• Passenger search supports partial name matching</p>
              <p>• Use advanced search to combine multiple criteria</p>
              <p>• All searches are case-insensitive</p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}