'use client';

import { format } from 'date-fns';
import { Train, Users, CreditCard, MapPin, Clock, Calendar } from 'lucide-react';
import type { FullTicket } from '@/lib/supabase';

interface TicketCardProps {
  ticket: FullTicket;
}

export default function TicketCard({ ticket }: TicketCardProps) {
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
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes('CNF') || statusUpper.includes('CONFIRMED')) {
      return 'bg-green-100 text-green-800';
    }
    if (statusUpper.includes('RAC')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (statusUpper.includes('WL') || statusUpper.includes('WAITING')) {
      return 'bg-orange-100 text-orange-800';
    }
    if (statusUpper.includes('CAN') || statusUpper.includes('CANCELLED')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Train className="h-5 w-5 text-blue-600" />
            PNR: {ticket.pnr}
          </h3>
          {ticket.transaction_id && (
            <p className="text-sm text-gray-600">Transaction: {ticket.transaction_id}</p>
          )}
        </div>
        <div className="text-right">
          {ticket.ticket_print_time && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              {formatDateTime(ticket.ticket_print_time)}
            </div>
          )}
          {ticket.class && (
            <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {ticket.class}
            </span>
          )}
        </div>
      </div>

      {/* Journey Information */}
      {ticket.journeys && ticket.journeys.length > 0 && (
        <div className="mb-4">
          <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Journey Details
          </h4>
          {ticket.journeys.map((journey, index) => (
            <div key={journey.id} className="border border-gray-200 rounded-lg p-4 mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-gray-900">
                  {journey.train_number} - {journey.train_name}
                </div>
                {journey.distance && (
                  <span className="text-sm text-gray-600">{journey.distance} km</span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Departure</div>
                  <div className="font-medium">{journey.boarding_station || 'N/A'}</div>
                  <div className="text-sm text-gray-600">
                    {formatDateTime(journey.boarding_datetime)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Arrival</div>
                  <div className="font-medium">{journey.destination_station || 'N/A'}</div>
                  <div className="text-sm text-gray-600">
                    {formatDateTime(journey.destination_datetime)}
                  </div>
                </div>
              </div>
              
              {journey.duration_minutes && (
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  Duration: {Math.floor(journey.duration_minutes / 60)}h {journey.duration_minutes % 60}m
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Passenger Information */}
      {ticket.passengers && ticket.passengers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Passengers ({ticket.passengers.length})
          </h4>
          <div className="space-y-2">
            {ticket.passengers.map((passenger, index) => (
              <div key={passenger.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{passenger.name}</div>
                  <div className="text-sm text-gray-600">
                    {passenger.age && `Age: ${passenger.age}`}
                    {passenger.gender && ` • ${passenger.gender}`}
                  </div>
                </div>
                {passenger.current_status && (
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(passenger.current_status)}`}>
                    {passenger.current_status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Information */}
      {ticket.payment && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-md font-medium text-gray-800 mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {ticket.payment.total && (
              <div>
                <div className="text-gray-600">Total Amount</div>
                <div className="font-medium text-lg text-green-600">
                  {formatCurrency(ticket.payment.total)}
                </div>
              </div>
            )}
            {ticket.payment.ticket_fare && (
              <div>
                <div className="text-gray-600">Ticket Fare</div>
                <div className="font-medium">{formatCurrency(ticket.payment.ticket_fare)}</div>
              </div>
            )}
            {ticket.payment.reservation_fee && (
              <div>
                <div className="text-gray-600">Reservation Fee</div>
                <div className="font-medium">{formatCurrency(ticket.payment.reservation_fee)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        Added to system: {format(new Date(ticket.created_at), 'MMM dd, yyyy HH:mm')}
        {ticket.updated_at !== ticket.created_at && (
          <span> • Updated: {format(new Date(ticket.updated_at), 'MMM dd, yyyy HH:mm')}</span>
        )}
      </div>
    </div>
  );
}