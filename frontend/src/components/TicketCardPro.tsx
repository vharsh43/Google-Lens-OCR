'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Train, 
  Users, 
  CreditCard, 
  MapPin, 
  Clock, 
  Calendar,
  ArrowRight,
  User,
  IndianRupee,
  Ticket,
  Route
} from 'lucide-react';
import JourneyTimeline from './JourneyTimeline';
import type { FullTicket } from '@/lib/supabase';

interface TicketCardProProps {
  ticket: FullTicket;
}

export default function TicketCardPro({ ticket }: TicketCardProProps) {
  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'MMM dd, HH:mm');
    } catch {
      return dateTime;
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'secondary';
    
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes('CNF') || statusUpper.includes('CONFIRMED')) {
      return 'default'; // Green
    }
    if (statusUpper.includes('RAC')) {
      return 'secondary'; // Yellow
    }
    if (statusUpper.includes('WL') || statusUpper.includes('WAITING')) {
      return 'outline'; // Orange
    }
    if (statusUpper.includes('CAN') || statusUpper.includes('CANCELLED')) {
      return 'destructive'; // Red
    }
    return 'secondary';
  };

  const parseSeatInfo = (status: string | null | undefined) => {
    if (!status) return null;
    
    // Parse format like "CNF/S4/1/LOWER" or "RLWL/4"
    const parts = status.split('/');
    if (parts.length >= 2) {
      if (parts.length === 4) {
        // Format: CNF/S4/1/LOWER
        return {
          coach: parts[1], // S4
          seat: parts[2], // 1
          berth: parts[3], // LOWER
          status: parts[0] // CNF
        };
      } else if (parts.length === 2) {
        // Format: RLWL/4 (waiting list)
        return {
          coach: '',
          seat: parts[1],
          berth: '',
          status: parts[0]
        };
      }
    }
    return null;
  };

  const primaryJourney = ticket.journeys?.[0];
  const hasMultipleJourneys = ticket.journeys && ticket.journeys.length > 1;

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        {/* Header with PNR and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg">PNR: {ticket.pnr}</h3>
                {hasMultipleJourneys && (
                  <Badge variant="outline" className="text-xs">
                    {ticket.journeys?.length} Segments
                  </Badge>
                )}
              </div>
              {ticket.transaction_id && (
                <p className="text-sm text-muted-foreground">ID: {ticket.transaction_id}</p>
              )}
            </div>
          </div>
          
          {ticket.ticket_print_time && (
            <div className="text-right">
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDateTime(ticket.ticket_print_time)}</span>
              </div>
              {primaryJourney?.class && (
                <Badge variant="secondary" className="mt-1">
                  {primaryJourney.class}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary Journey Information */}
        {primaryJourney && (
          <div className="space-y-3">
            {/* Train Details */}
            <div className="flex items-center space-x-2">
              <Train className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {primaryJourney.train_number} - {primaryJourney.train_name}
              </span>
              {primaryJourney.distance && (
                <Badge variant="outline" className="ml-auto">
                  {primaryJourney.distance} km
                </Badge>
              )}
            </div>

            {/* Route */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    <span>From</span>
                  </div>
                  <div className="font-medium">{primaryJourney.boarding_station || 'N/A'}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(primaryJourney.boarding_datetime)}
                  </div>
                </div>

                <div className="px-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end space-x-2 text-sm text-muted-foreground mb-1">
                    <span>To</span>
                    <MapPin className="h-3 w-3" />
                  </div>
                  <div className="font-medium">{primaryJourney.destination_station || 'N/A'}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(primaryJourney.destination_datetime)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Passenger Summary */}
        {ticket.passengers && ticket.passengers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              <span>Passengers ({ticket.passengers.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {ticket.passengers.slice(0, 2).map((passenger) => {
                const seatInfo = parseSeatInfo(passenger.current_status);
                return (
                  <div key={passenger.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{passenger.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {passenger.age && `${passenger.age}y`}
                            {passenger.gender && ` • ${passenger.gender}`}
                          </span>
                        </div>
                        {seatInfo && seatInfo.coach && seatInfo.seat && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Train className="h-2 w-2" />
                            <span>Coach {seatInfo.coach}, Seat {seatInfo.seat} ({seatInfo.berth})</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {passenger.current_status && (
                      <div className="flex flex-col items-end space-y-1">
                        <Badge variant={getStatusColor(passenger.current_status)} className="text-xs">
                          {seatInfo?.status || passenger.current_status}
                        </Badge>
                        {seatInfo && !seatInfo.coach && seatInfo.seat && (
                          <span className="text-xs text-muted-foreground">#{seatInfo.seat}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {ticket.passengers.length > 2 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  +{ticket.passengers.length - 2} more passengers
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Summary */}
        {ticket.payment && ticket.payment.total && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total Fare</span>
              </div>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(ticket.payment.total)}
              </div>
            </div>
            {ticket.passengers && ticket.passengers.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Per Passenger:</span>
                <span className="text-sm font-medium text-blue-600">
                  {formatCurrency(ticket.payment.total / ticket.passengers.length)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Expandable Details */}
        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border-none">
            <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2">
              View Full Details
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {/* Journey Timeline for Multiple Segments */}
              {hasMultipleJourneys && (
                <JourneyTimeline ticket={ticket} />
              )}

              {/* All Passengers */}
              {ticket.passengers && ticket.passengers.length > 2 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">All Passengers</h4>
                  <div className="space-y-2">
                    {ticket.passengers.map((passenger) => {
                      const seatInfo = parseSeatInfo(passenger.current_status);
                      return (
                        <div key={passenger.id} className="flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {passenger.name} ({passenger.age}y, {passenger.gender})
                            </span>
                            {seatInfo && seatInfo.coach && seatInfo.seat && (
                              <span className="text-muted-foreground">
                                Coach {seatInfo.coach} • Seat {seatInfo.seat} • {seatInfo.berth}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <Badge variant={getStatusColor(passenger.current_status)} className="text-xs">
                              {seatInfo?.status || passenger.current_status}
                            </Badge>
                            {seatInfo && !seatInfo.coach && seatInfo.seat && (
                              <span className="text-xs text-muted-foreground">Position #{seatInfo.seat}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              {ticket.payment && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Payment Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ticket.payment.ticket_fare && (
                      <div className="flex justify-between">
                        <span>Ticket Fare:</span>
                        <span>{formatCurrency(ticket.payment.ticket_fare)}</span>
                      </div>
                    )}
                    {ticket.payment.reservation_fee && (
                      <div className="flex justify-between">
                        <span>Reservation Fee:</span>
                        <span>{formatCurrency(ticket.payment.reservation_fee)}</span>
                      </div>
                    )}
                    {ticket.payment.total && (
                      <div className="flex justify-between font-medium pt-1 border-t col-span-2">
                        <span>Total:</span>
                        <span>{formatCurrency(ticket.payment.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}