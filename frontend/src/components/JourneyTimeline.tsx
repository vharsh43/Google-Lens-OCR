'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Train, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Circle,
  Route,
  Timer,
  Calendar
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import type { FullTicket } from '@/lib/supabase';

interface JourneyTimelineProps {
  ticket: FullTicket;
}

export default function JourneyTimeline({ ticket }: JourneyTimelineProps) {
  if (!ticket.journeys || ticket.journeys.length === 0) {
    return null;
  }

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'MMM dd, HH:mm');
    } catch {
      return dateTime;
    }
  };

  const formatTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'HH:mm');
    } catch {
      return dateTime;
    }
  };

  const formatDate = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'MMM dd');
    } catch {
      return dateTime;
    }
  };

  const calculateLayoverTime = (arrival: string | null, departure: string | null) => {
    if (!arrival || !departure) return null;
    try {
      const arrivalTime = new Date(arrival);
      const departureTime = new Date(departure);
      const minutes = differenceInMinutes(departureTime, arrivalTime);
      
      if (minutes < 60) {
        return `${minutes}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
      }
    } catch {
      return null;
    }
  };

  const isMultiSegment = ticket.journeys.length > 1;
  const sortedJourneys = [...ticket.journeys].sort((a, b) => {
    if (!a.boarding_datetime || !b.boarding_datetime) return 0;
    return new Date(a.boarding_datetime).getTime() - new Date(b.boarding_datetime).getTime();
  });

  const totalJourneyTime = (() => {
    if (sortedJourneys.length === 0) return null;
    const firstJourney = sortedJourneys[0];
    const lastJourney = sortedJourneys[sortedJourneys.length - 1];
    
    if (!firstJourney.boarding_datetime || !lastJourney.destination_datetime) return null;
    
    try {
      const start = new Date(firstJourney.boarding_datetime);
      const end = new Date(lastJourney.destination_datetime);
      const minutes = differenceInMinutes(end, start);
      
      if (minutes < 60) {
        return `${minutes}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
      }
    } catch {
      return null;
    }
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Route className="w-5 h-5" />
          <span>Journey Timeline</span>
          {isMultiSegment && (
            <Badge variant="secondary" className="ml-2">
              {sortedJourneys.length} Segments
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isMultiSegment 
            ? `Multi-segment journey with ${sortedJourneys.length} trains`
            : "Direct journey timeline"
          }
          {totalJourneyTime && ` • Total duration: ${totalJourneyTime}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {sortedJourneys.map((journey, index) => {
          const isLastSegment = index === sortedJourneys.length - 1;
          const nextJourney = !isLastSegment ? sortedJourneys[index + 1] : null;
          const layoverTime = nextJourney 
            ? calculateLayoverTime(journey.destination_datetime, nextJourney.boarding_datetime)
            : null;

          return (
            <div key={journey.id} className="space-y-4">
              {/* Journey Segment */}
              <div className="relative">
                {/* Train Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Train className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {journey.train_number} - {journey.train_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Segment {index + 1}
                        {journey.class && ` • ${journey.class}`}
                        {journey.distance && ` • ${journey.distance} km`}
                      </div>
                    </div>
                  </div>
                  {formatDate(journey.boarding_datetime) !== 'N/A' && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(journey.boarding_datetime)}
                    </Badge>
                  )}
                </div>

                {/* Journey Route */}
                <div className="ml-10 space-y-3">
                  {/* Departure */}
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Circle className="h-3 w-3 text-green-500 fill-current" />
                      <div className="absolute top-3 left-1/2 w-0.5 h-8 bg-border transform -translate-x-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{journey.boarding_station || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">Departure</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">{formatTime(journey.boarding_datetime)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(journey.boarding_datetime)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Journey Duration */}
                  <div className="flex items-center space-x-3">
                    <div className="w-3 flex justify-center">
                      <div className="w-0.5 h-4 bg-border" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Timer className="w-3 h-3" />
                        <span>Journey in progress</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrival */}
                  <div className="flex items-center space-x-3">
                    <Circle className="h-3 w-3 text-red-500 fill-current" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{journey.destination_station || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">Arrival</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">{formatTime(journey.destination_datetime)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(journey.destination_datetime)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layover/Connection */}
              {!isLastSegment && (
                <div className="ml-10 space-y-2">
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <div>
                        <div className="text-sm font-medium">Connection at {journey.destination_station}</div>
                        <div className="text-xs text-muted-foreground">
                          Wait for next train
                        </div>
                      </div>
                    </div>
                    {layoverTime && (
                      <Badge variant="outline" className="text-xs">
                        <Timer className="w-3 h-3 mr-1" />
                        {layoverTime}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Journey Summary */}
        {isMultiSegment && (
          <div className="mt-6 pt-4 border-t">
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm mb-1">Complete Journey</h4>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>{sortedJourneys[0]?.boarding_station}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{sortedJourneys[sortedJourneys.length - 1]?.destination_station}</span>
                  </div>
                </div>
                <div className="text-right">
                  {totalJourneyTime && (
                    <div className="text-sm font-medium">{totalJourneyTime}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {sortedJourneys.length} segment{sortedJourneys.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}