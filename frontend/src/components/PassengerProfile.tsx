'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Users, 
  Train, 
  Calendar,
  MapPin,
  Ticket,
  TrendingUp,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import type { FullTicket } from '@/lib/supabase';

interface PassengerProfileProps {
  passenger: {
    name: string;
    age: number;
    gender?: string;
    tickets: FullTicket[];
  };
  onViewTicket?: (ticketId: string) => void;
}

export default function PassengerProfile({ passenger, onViewTicket }: PassengerProfileProps) {
  const formatDate = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'MMM dd, yyyy');
    } catch {
      return dateTime;
    }
  };

  const totalJourneys = passenger.tickets.reduce((total, ticket) => {
    return total + (ticket.journeys?.length || 0);
  }, 0);

  const uniqueRoutes = new Set(
    passenger.tickets.flatMap(ticket => 
      ticket.journeys?.map(journey => 
        `${journey.boarding_station}-${journey.destination_station}`
      ) || []
    )
  ).size;

  const recentTickets = [...passenger.tickets]
    .sort((a, b) => {
      const dateA = a.ticket_print_time ? new Date(a.ticket_print_time).getTime() : 0;
      const dateB = b.ticket_print_time ? new Date(b.ticket_print_time).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const frequentRoutes = (() => {
    const routeCount = new Map<string, number>();
    
    passenger.tickets.forEach(ticket => {
      ticket.journeys?.forEach(journey => {
        const route = `${journey.boarding_station} → ${journey.destination_station}`;
        routeCount.set(route, (routeCount.get(route) || 0) + 1);
      });
    });

    return Array.from(routeCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{passenger.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {passenger.age}y
                </Badge>
                {passenger.gender && (
                  <Badge variant="outline" className="text-xs">
                    {passenger.gender}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Passenger profile with {passenger.tickets.length} ticket{passenger.tickets.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Travel Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-primary">{passenger.tickets.length}</div>
            <div className="text-xs text-muted-foreground">Tickets</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-primary">{totalJourneys}</div>
            <div className="text-xs text-muted-foreground">Journeys</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-primary">{uniqueRoutes}</div>
            <div className="text-xs text-muted-foreground">Routes</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-primary">
              {passenger.tickets.reduce((total, ticket) => {
                const ticketTotal = ticket.payment?.total || 0;
                const passengerCount = ticket.passengers?.length || 1;
                return total + (ticketTotal / passengerCount);
              }, 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-muted-foreground">₹ Spent</div>
          </div>
        </div>

        <Separator />

        {/* Frequent Routes */}
        {frequentRoutes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Most Traveled Routes</span>
            </div>
            <div className="space-y-1">
              {frequentRoutes.map(([route, count]) => (
                <div key={route} className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{route}</span>
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {count}x
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Recent Tickets */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            <span>Recent Travel History</span>
          </div>
          <div className="space-y-2">
            {recentTickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <Ticket className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-sm">PNR: {ticket.pnr}</span>
                    {ticket.journeys && ticket.journeys.length > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {ticket.journeys.length} segments
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ticket.journeys?.[0]?.boarding_station} → {ticket.journeys?.[ticket.journeys.length - 1]?.destination_station}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(ticket.ticket_print_time)}</span>
                    {ticket.payment?.total && (
                      <span className="ml-auto">
                        ₹{Math.round(ticket.payment.total / (ticket.passengers?.length || 1)).toLocaleString('en-IN')} 
                        <span className="text-xs ml-1">per person</span>
                      </span>
                    )}
                  </div>
                </div>
                {onViewTicket && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewTicket(ticket.id)}
                    className="ml-2 h-8 px-2"
                  >
                    View
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Passenger Insights */}
        <div className="bg-primary/5 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Travel Insights</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              • Average: ₹{(passenger.tickets.reduce((total, ticket) => {
                const ticketTotal = ticket.payment?.total || 0;
                const passengerCount = ticket.passengers?.length || 1;
                return total + (ticketTotal / passengerCount);
              }, 0) / passenger.tickets.length).toFixed(0)} per trip
            </div>
            <div>
              • Preferred class: {(() => {
                const classes = passenger.tickets.flatMap(t => 
                  t.journeys?.map(j => j.class) || []
                ).filter(Boolean);
                const classCount = classes.reduce((acc, cls) => {
                  acc[cls] = (acc[cls] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                const mostFrequent = Object.entries(classCount)
                  .sort(([,a], [,b]) => b - a)[0];
                return mostFrequent ? mostFrequent[0] : 'N/A';
              })()}
            </div>
            <div>
              • Journey patterns: {passenger.tickets.some(t => 
                t.journeys && t.journeys.length > 1
              ) ? 'Multi-segment traveler' : 'Direct routes preferred'}
            </div>
            <div>
              • Travel frequency: {passenger.tickets.length > 5 ? 'Frequent' : 
                passenger.tickets.length > 2 ? 'Regular' : 'Occasional'} traveler
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}