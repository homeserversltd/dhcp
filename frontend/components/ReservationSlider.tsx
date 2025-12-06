import React, { useState, useEffect } from 'react';
import { DhcpStatistics } from '../types';

interface ReservationSliderProps {
  statistics: DhcpStatistics | null;
  currentReservations: number;
  currentHosts: number;
  currentBoundary?: number;
  onBoundaryUpdate: (maxReservations: number) => Promise<void>;
  onAddReservation?: (mac: string, ip: string) => Promise<void>;
  isLoading?: boolean;
}

export const ReservationSlider: React.FC<ReservationSliderProps> = ({
  statistics,
  currentReservations,
  currentHosts,
  currentBoundary,
  onBoundaryUpdate,
  onAddReservation,
  isLoading = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  // Initialize with current boundary if available, otherwise use current reservations
  const initialValue = currentBoundary !== undefined ? currentBoundary : currentReservations;
  const [sliderValue, setSliderValue] = useState(initialValue);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newMac, setNewMac] = useState('');
  const [newIp, setNewIp] = useState('');
  const [isAddingReservation, setIsAddingReservation] = useState(false);

  // Total IPs available: 192.168.123.2 to 192.168.123.250 = 249 IPs
  const TOTAL_IPS = 249;
  
  // Calculate constraints
  const minValue = currentReservations; // Can't go below existing reservations
  // Constraint logic:
  // - If there are 0 active hosts (leases), we can set all IPs to reservations (max = TOTAL_IPS, leaving 0 leases capacity)
  // - If there are active hosts, we must ensure at least that many leases can be accommodated
  //   So max reservations = TOTAL_IPS - active_hosts_count
  const maxValue = currentHosts === 0 ? TOTAL_IPS : TOTAL_IPS - currentHosts;

  useEffect(() => {
    // Update slider value when current boundary or reservations change
    const newValue = currentBoundary !== undefined ? currentBoundary : currentReservations;
    setSliderValue(newValue);
  }, [currentBoundary, currentReservations]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
  };

  const handleSliderRelease = async () => {
    const previousValue = currentBoundary !== undefined ? currentBoundary : currentReservations;
    if (sliderValue === previousValue) {
      return; // No change
    }

    setIsUpdating(true);
    try {
      await onBoundaryUpdate(sliderValue);
    } catch (err) {
      console.error('Failed to update boundary:', err);
      // Reset slider on error
      setSliderValue(previousValue);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddReservation = async () => {
    if (!newMac || !newIp || !onAddReservation) {
      return;
    }

    setIsAddingReservation(true);
    try {
      await onAddReservation(newMac, newIp);
      setNewMac('');
      setNewIp('');
    } catch (err) {
      console.error('Failed to add reservation:', err);
    } finally {
      setIsAddingReservation(false);
    }
  };

  // Calculate reserved and pool ranges based on slider value
  // If sliderValue = N, we can have up to N reservations
  // Reserved range: 192.168.123.2 to 192.168.123.(N+1) gives us N IPs (2, 3, ..., N+1)
  // Pool range: 192.168.123.(N+2) to 192.168.123.250
  const reservedEnd = sliderValue + 1; // Last IP in reserved range
  const poolStart = reservedEnd + 1; // First IP in pool range
  const poolEnd = 250; // Last IP in pool range

  const reservedRange = `192.168.123.2 - 192.168.123.${reservedEnd}`;
  const poolRange = `192.168.123.${poolStart} - 192.168.123.${poolEnd}`;

  // Show manual addition when hosts = 0
  const showManualAddition = currentHosts === 0;
  // Show MAC/IP input when hosts = 0 and all IPs are reserved (slider at max)
  const showMacIpInput = showManualAddition && sliderValue >= maxValue;

  if (!isVisible) {
    return (
      <div className="reservation-slider-container">
        <button
          onClick={() => setIsVisible(true)}
          className="dhcp-action-button"
          disabled={isLoading}
        >
          Configure Reservations vs Leases
        </button>
      </div>
    );
  }

  return (
    <div className="reservation-slider-container expanded">
      <div className="reservation-slider-header">
        <h3>Reservations vs Leases</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="slider-close-button"
          disabled={isUpdating}
        >
          ×
        </button>
      </div>

      <div className="reservation-slider-content">
        <div className="slider-info">
          <div className="slider-info-item">
            <span className="slider-info-label">Current Reservations:</span>
            <span className="slider-info-value">{currentReservations}</span>
          </div>
          <div className="slider-info-item">
            <span className="slider-info-label">Current Hosts:</span>
            <span className="slider-info-value">{currentHosts}</span>
          </div>
          <div className="slider-info-item">
            <span className="slider-info-label">Max Reservations:</span>
            <span className="slider-info-value">{sliderValue}</span>
          </div>
        </div>

        <div className="slider-control">
          <div className="slider-labels">
            <span className="slider-label-left">More Reservations</span>
            <span className="slider-label-right">More Leases</span>
          </div>
          <input
            type="range"
            min={minValue}
            max={maxValue}
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="reservation-slider"
            disabled={isUpdating || isLoading}
          />
          <div className="slider-constraints">
            <span className="slider-constraint">Min: {minValue} (current reservations)</span>
            <span className="slider-constraint">
              Max: {maxValue} {currentHosts === 0 ? '(0 active hosts, can set to 0 leases)' : `(ensuring ${currentHosts} active hosts minimum)`}
            </span>
          </div>
        </div>

        <div className="slider-ranges">
          <div className="range-display">
            <span className="range-label">Reserved Range:</span>
            <span className="range-value">{reservedRange}</span>
          </div>
          <div className="range-display">
            <span className="range-label">Pool Range:</span>
            <span className="range-value">{poolRange}</span>
          </div>
        </div>

        {isUpdating && (
          <div className="slider-updating">
            Updating Kea configuration...
          </div>
        )}

        {showManualAddition && !showMacIpInput && (
          <div className="manual-addition-box">
            <p>No active hosts detected. You can manually add reservations below.</p>
          </div>
        )}

        {showMacIpInput && (
          <div className="mac-ip-input-row">
            <h4>Add New Reservation</h4>
            <div className="mac-ip-inputs">
              <div className="input-group">
                <label htmlFor="new-mac">MAC Address:</label>
                <input
                  id="new-mac"
                  type="text"
                  value={newMac}
                  onChange={(e) => setNewMac(e.target.value)}
                  placeholder="aa:bb:cc:dd:ee:ff"
                  className="mac-input"
                  disabled={isAddingReservation}
                />
              </div>
              <div className="input-group">
                <label htmlFor="new-ip">IP Address:</label>
                <input
                  id="new-ip"
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="192.168.123.2"
                  className="ip-input"
                  disabled={isAddingReservation}
                />
              </div>
              <button
                onClick={handleAddReservation}
                className="add-reservation-button"
                disabled={!newMac || !newIp || isAddingReservation}
              >
                {isAddingReservation ? 'Adding...' : 'Add Reservation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

