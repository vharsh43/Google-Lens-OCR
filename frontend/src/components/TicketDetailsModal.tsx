'use client';

import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Bed,
  CarTaxiFront
} from 'lucide-react';
import JourneyTimeline from './JourneyTimeline';
import type { FullTicket } from '@/lib/supabase';

interface TicketDetailsModalProps {
  ticket: FullTicket | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedSeatInfo {
  coach: string;
  seatNumber: string;
  berthType: string;
  status: string;
}

export default function TicketDetailsModal({ ticket, isOpen, onClose }: TicketDetailsModalProps) {
  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'N/A';
    try {
      return format(new Date(dateTime), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateTime;
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const parseSeatInfo = (currentStatus: string | null | undefined): ParsedSeatInfo | null => {
    if (!currentStatus) return null;
    
    // Parse format like "CNF/S4/1/LOWER" or "RLWL/4"
    const parts = currentStatus.split('/');
    if (parts.length >= 2) {
      const status = parts[0]; // CNF, RLWL, RAC, etc.
      
      if (parts.length === 4) {
        // Format: CNF/S4/1/LOWER
        return {
          coach: parts[1], // S4
          seatNumber: parts[2], // 1
          berthType: parts[3], // LOWER
          status: status // CNF
        };
      } else if (parts.length === 2) {
        // Format: RLWL/4 (waiting list)
        return {
          coach: '',
          seatNumber: parts[1],
          berthType: '',
          status: status
        };
      }
    }
    
    return {
      coach: '',
      seatNumber: '',
      berthType: '',
      status: currentStatus
    };
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

  const calculatePerPassengerFare = (ticket: FullTicket) => {
    if (!ticket.payment?.total || !ticket.passengers?.length) return 0;
    return ticket.payment.total / ticket.passengers.length;
  };

  if (!ticket) return null;

  const primaryJourney = ticket.journeys?.[0];
  const hasMultipleJourneys = ticket.journeys && ticket.journeys.length > 1;
  const perPassengerFare = calculatePerPassengerFare(ticket);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Ticket className="h-5 w-5 text-primary" />
            <span>Ticket Details - PNR: {ticket.pnr}</span>
          </DialogTitle>
          <DialogDescription>
            Complete ticket information including passenger seat allocations and journey details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Ticket Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Train className="h-5 w-5" />
                <span>Journey Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryJourney && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {primaryJourney.train_number} - {primaryJourney.train_name}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Class: {primaryJourney.class}</span>
                        {primaryJourney.distance && <span>Distance: {primaryJourney.distance} km</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Booked: {formatDateTime(ticket.ticket_print_time)}</span>
                      </div>
                      {ticket.transaction_id && (
                        <div className="text-xs text-muted-foreground">
                          Transaction: {ticket.transaction_id}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Information */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                          <MapPin className="h-3 w-3" />
                          <span>Departure</span>
                        </div>
                        <div className="font-medium text-lg">{primaryJourney.boarding_station || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(primaryJourney.boarding_datetime)}
                        </div>
                      </div>

                      <div className="px-6">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      </div>

                      <div className="flex-1 text-right">
                        <div className="flex items-center justify-end space-x-2 text-sm text-muted-foreground mb-1">
                          <span>Arrival</span>
                          <MapPin className="h-3 w-3" />
                        </div>
                        <div className="font-medium text-lg">{primaryJourney.destination_station || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(primaryJourney.destination_datetime)}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Multi-journey timeline */}
              {hasMultipleJourneys && (
                <div className="mt-4">
                  <JourneyTimeline ticket={ticket} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Passenger Details with Seat Information */}
          {ticket.passengers && ticket.passengers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Passenger Details & Seat Allocation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ticket.passengers.map((passenger, index) => {
                    const seatInfo = parseSeatInfo(passenger.current_status);
                    return (
                      <div key={passenger.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold">{passenger.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {passenger.age}y
                              </Badge>
                              {passenger.gender && (
                                <Badge variant="outline" className="text-xs">
                                  {passenger.gender}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Per-passenger fare: {formatCurrency(perPassengerFare)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {/* Seat Information */}
                          {seatInfo && (
                            <div className="text-right">
                              <div className="flex items-center space-x-2">
                                {seatInfo.coach && (
                                  <Badge variant="secondary" className="text-xs">
                                    <CarTaxiFront className="h-3 w-3 mr-1" />
                                    {seatInfo.coach}
                                  </Badge>
                                )}
                                {seatInfo.seatNumber && seatInfo.berthType && (
                                  <Badge variant="outline" className="text-xs">
                                    <Bed className="h-3 w-3 mr-1" />
                                    {seatInfo.seatNumber} {seatInfo.berthType}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Seat: {passenger.current_status}
                              </div>
                            </div>
                          )}

                          {/* Status Badge */}
                          <Badge variant={getStatusColor(passenger.current_status)} className="text-sm">
                            {seatInfo?.status || passenger.current_status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Details */}
          {ticket.payment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Payment Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {ticket.payment.ticket_fare && (
                      <div className="flex justify-between">
                        <span>Base Ticket Fare:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.ticket_fare)}</span>
                      </div>
                    )}
                    {ticket.payment.reservation_fee && (
                      <div className="flex justify-between">
                        <span>Reservation Fee:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.reservation_fee)}</span>
                      </div>
                    )}
                    {ticket.payment.insurance && (
                      <div className="flex justify-between">
                        <span>Insurance:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.insurance)}</span>
                      </div>
                    )}
                    {ticket.payment.agent_fee && (
                      <div className="flex justify-between">
                        <span>Agent Fee:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.agent_fee)}</span>
                      </div>
                    )}
                    {ticket.payment.pg_charges && (
                      <div className="flex justify-between">
                        <span>Payment Gateway:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.pg_charges)}</span>
                      </div>
                    )}
                    {ticket.payment.irctc_fee && (
                      <div className="flex justify-between">
                        <span>IRCTC Fee:</span>
                        <span className="font-medium">{formatCurrency(ticket.payment.irctc_fee)}</span>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total Amount:</span>
                      <span className="text-green-600">{formatCurrency(ticket.payment.total)}</span>
                    </div>
                    
                    <div className="flex justify-between font-medium">
                      <span>Per Passenger:</span>
                      <span className="text-blue-600">{formatCurrency(perPassengerFare)}</span>
                    </div>
                  </div>
                  
                  {ticket.passengers && (
                    <div className="text-xs text-muted-foreground text-center">
                      Total divided by {ticket.passengers.length} passenger{ticket.passengers.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}