import React, { useState, useEffect, useMemo } from 'react';
import './PortalCard.css';
import { DhcpLease, DhcpReservation, UnifiedLeaseItem, DhcpStatistics } from './types';
import { DhcpCard } from './components/DhcpCard';
import { useDhcpControls } from './hooks/useDhcpControls';

const DhcpTablet: React.FC = () => {
  const {
    getLeases,
    getReservations,
    addReservation,
    removeReservation,
    updateReservation,
    getStatistics,
    isLoading,
    error
  } = useDhcpControls();

  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [statistics, setStatistics] = useState<DhcpStatistics | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leasesData, reservationsData, statisticsData] = await Promise.all([
        getLeases(),
        getReservations(),
        getStatistics()
      ]);
      setLeases(leasesData);
      setReservations(reservationsData);
      setStatistics(statisticsData);
    } catch (err) {
      console.error('Failed to load DHCP data:', err);
    }
  };

  const unifiedItems: UnifiedLeaseItem[] = useMemo(() => {
    const items: UnifiedLeaseItem[] = [];
    
    // Add reservations first (pinned items)
    reservations.forEach(res => {
      items.push({ ...res, type: 'reservation' });
    });
    
    // Add leases (filter out any that are already reserved)
    const reservedMacs = new Set(reservations.map(r => r['hw-address'].toLowerCase()));
    leases.forEach(lease => {
      if (!reservedMacs.has(lease['hw-address'].toLowerCase())) {
        items.push({ ...lease, type: 'lease' });
      }
    });
    
    return items;
  }, [leases, reservations]);

  const handlePin = async (lease: DhcpLease) => {
    try {
      // Don't pass IP address - backend will auto-assign from reserved range (2-49)
      await addReservation(
        lease['hw-address'],
        undefined, // Let backend auto-assign from reserved range
        lease.hostname || undefined
      );
      await loadData();
    } catch (err) {
      console.error('Failed to pin lease:', err);
      throw err;
    }
  };

  const handleUpdateIp = async (identifier: string, newIp: string) => {
    try {
      await updateReservation(identifier, newIp);
      await loadData();
    } catch (err) {
      console.error('Failed to update IP:', err);
      throw err;
    }
  };

  const handleRemoveReservation = async (identifier: string) => {
    try {
      await removeReservation(identifier);
      await loadData();
    } catch (err) {
      console.error('Failed to remove reservation:', err);
    }
  };

  return (
    <div className="dhcp-tablet">
      {statistics && (
        <div className="dhcp-info-banner">
          <span className="dhcp-info-item">
            Homeserver: <span className="dhcp-info-value">{statistics.homeserver_ip}</span>
          </span>
          <span className="dhcp-info-separator">|</span>
          <span className="dhcp-info-item">
            Reservations: <span className="dhcp-info-value">{statistics.reservations_count}/{statistics.reservations_total}</span>
          </span>
          <span className="dhcp-info-separator">|</span>
          <span className="dhcp-info-item">
            Hosts: <span className="dhcp-info-value">{statistics.leases_count}/{statistics.leases_total}</span>
          </span>
        </div>
      )}
      <div className="dhcp-button-row">
        <button
          onClick={loadData}
          className="dhcp-action-button"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="dhcp-tablet-content">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && !leases.length && !reservations.length && (
          <div className="loading-banner">
            Loading...
          </div>
        )}

        <div className="dhcp-list">
          {unifiedItems.length > 0 ? (
            unifiedItems.map((item, index) => (
              <DhcpCard
                key={`${item.type}-${item['hw-address']}-${item['ip-address']}-${index}`}
                item={item}
                onPin={handlePin}
                onUpdateIp={handleUpdateIp}
                onRemove={handleRemoveReservation}
              />
            ))
          ) : (
            !isLoading && (
              <div className="dhcp-empty-state">
                <p>No DHCP leases or reservations found.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default DhcpTablet;

