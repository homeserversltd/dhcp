import React, { useState } from 'react';
import { DhcpLease, DhcpReservation } from '../types';

interface DhcpCardProps {
  lease?: DhcpLease;
  reservation?: DhcpReservation;
  type: 'lease' | 'reservation';
  onRemove?: (identifier: string) => void;
  className?: string;
}

export const DhcpCard: React.FC<DhcpCardProps> = ({ 
  lease,
  reservation,
  type,
  onRemove,
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRemove = () => {
    if (onRemove) {
      const identifier = type === 'lease' 
        ? lease?.['hw-address'] || lease?.['ip-address'] || ''
        : reservation?.['hw-address'] || reservation?.['ip-address'] || '';
      onRemove(identifier);
    }
  };

  const displayData = type === 'lease' ? lease : reservation;
  if (!displayData) return null;

  return (
    <div className={`dhcp-card ${className} ${type}`}>
      <div className="dhcp-card-header">
        <div className="dhcp-card-title">
          <h3>{displayData['ip-address']}</h3>
          <span className={`type-badge ${type}`}>
            {type === 'lease' ? 'Lease' : 'Reservation'}
          </span>
        </div>
        <button 
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      <div className="dhcp-card-content">
        <div className="dhcp-card-info">
          <div className="info-row">
            <span className="info-label">MAC Address:</span>
            <span className="info-value">{displayData['hw-address']}</span>
          </div>
          {displayData.hostname && (
            <div className="info-row">
              <span className="info-label">Hostname:</span>
              <span className="info-value">{displayData.hostname}</span>
            </div>
          )}
          {type === 'lease' && lease && (
            <>
              {lease.expire && (
                <div className="info-row">
                  <span className="info-label">Expires:</span>
                  <span className="info-value">{lease.expire}</span>
                </div>
              )}
              {lease.state && (
                <div className="info-row">
                  <span className="info-label">State:</span>
                  <span className="info-value">{lease.state}</span>
                </div>
              )}
            </>
          )}
        </div>

        {isExpanded && (
          <div className="dhcp-card-expanded">
            {type === 'reservation' && onRemove && (
              <div className="dhcp-actions">
                <button 
                  onClick={handleRemove}
                  className="remove-button"
                >
                  Remove Reservation
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

