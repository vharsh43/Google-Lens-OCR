'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Train, Users, CreditCard, TrendingUp, Sparkles } from 'lucide-react';
import { TicketAPI } from '@/lib/api';

interface StatisticsData {
  total_tickets: number;
  total_passengers: number;
  total_journeys: number;
  unique_trains: number;
  unique_passengers?: number;
  multi_ticket_passengers?: number;
  average_ticket_value?: number;
  date_range?: {
    earliest_ticket: string;
    latest_ticket: string;
  };
  [key: string]: unknown;
}

export default function Statistics() {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await TicketAPI.getStatistics();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch statistics:', err);
        setError('Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Database Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
                <Skeleton className="h-6 w-16 mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <BarChart3 className="h-5 w-5" />
            <span>Statistics Unavailable</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {error || 'Unable to load database statistics at this time.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>System Statistics</span>
          <Badge variant="outline" className="ml-auto">
            <Sparkles className="w-3 h-3 mr-1" />
            Live Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto">
              <Train className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(stats.total_tickets || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Tickets</div>
          </div>

          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center mx-auto">
              <Users className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(stats.total_passengers || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Bookings</div>
          </div>

          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(stats.total_journeys || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Journeys</div>
          </div>

          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center mx-auto">
              <Train className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(stats.unique_trains || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Trains</div>
          </div>

          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mx-auto">
              <Users className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(stats.unique_passengers || stats.total_passengers || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Unique</div>
          </div>

          <div className="text-center space-y-2">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CreditCard className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold text-foreground">
              ₹{formatNumber(Math.floor(stats.average_ticket_value || 0))}
            </div>
            <div className="text-xs text-muted-foreground">Avg Value</div>
          </div>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Avg Passengers/Ticket</div>
            <div className="text-lg font-semibold">
              {stats.total_tickets > 0 
                ? (stats.total_passengers / stats.total_tickets).toFixed(1)
                : '0'
              }
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Avg Journeys/Ticket</div>
            <div className="text-lg font-semibold">
              {stats.total_tickets > 0 
                ? (stats.total_journeys / stats.total_tickets).toFixed(1)
                : '0'
              }
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">System Status</div>
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              ✓ Connected
            </Badge>
          </div>
        </div>

        {/* Date Range */}
        {stats.date_range && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Data Since</div>
                <div className="font-medium">
                  {formatDate(stats.date_range.earliest_ticket)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Latest Update</div>
                <div className="font-medium">
                  {formatDate(stats.date_range.latest_ticket)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}