import React, { useState, useEffect, useMemo } from 'react';
import './PortalCard.css';
import { DhcpLease, DhcpReservation, UnifiedLeaseItem, DhcpStatistics } from './types';
import { DhcpCard } from './components/DhcpCard';
import { ReservationSlider } from './components/ReservationSlider';
import { useDhcpControls } from './hooks/useDhcpControls';

const DhcpTablet: React.FC = () => {
  const {
    getLeases,
    getReservations,
    addReservation,
    removeReservation,
    updateReservation,
    getStatistics,
    getPoolBoundary,
    updatePoolBoundary,
    isLoading,
    error
  } = useDhcpControls();

  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [statistics, setStatistics] = useState<DhcpStatistics | null>(null);
  const [currentBoundary, setCurrentBoundary] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[DHCP] Loading data...');
      // Fetch all data in parallel for better performance
      const [leasesData, reservationsData, statisticsData, boundaryData] = await Promise.all([
        getLeases(),
        getReservations(),
        getStatistics(),
        getPoolBoundary().catch((err) => {
          console.warn('[DHCP] Failed to get pool boundary:', err);
          return undefined;
        })
      ]);
      
      console.log('[DHCP] Loaded data:', {
        leasesCount: leasesData.length,
        reservationsCount: reservationsData.length,
        statistics: statisticsData,
        boundary: boundaryData
      });
      
      // Update state atomically to prevent UI flicker
      setLeases(leasesData);
      setReservations(reservationsData);
      setStatistics(statisticsData);
      setCurrentBoundary(boundaryData);
      
      console.log('[DHCP] State updated with statistics:', {
        reservations_count: statisticsData?.reservations_count,
        reservations_total: statisticsData?.reservations_total,
        leases_count: statisticsData?.leases_count,
        leases_total: statisticsData?.leases_total
      });
      
      // Force a re-render by logging the updated counts
      console.log('[DHCP] Updated counts - Reservations:', reservationsData.length, 'Hosts:', leasesData.length);
    } catch (err) {
      console.error('[DHCP] Failed to load DHCP data:', err);
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
      console.log('[DHCP] Pinning lease:', lease);
      // Don't pass IP address - backend will auto-assign from reserved range (2-49)
      await addReservation(
        lease['hw-address'],
        undefined, // Let backend auto-assign from reserved range
        lease.hostname || undefined
      );
      console.log('[DHCP] Reservation added, reloading data...');
      // Reload all data to update statistics and lists
      await loadData();
      console.log('[DHCP] Data reloaded after pin');
    } catch (err) {
      console.error('[DHCP] Failed to pin lease:', err);
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
      console.log('[DHCP] Removing reservation:', identifier);
      await removeReservation(identifier);
      console.log('[DHCP] Reservation removed, reloading data...');
      await loadData();
      console.log('[DHCP] Data reloaded after removal');
    } catch (err) {
      console.error('[DHCP] Failed to remove reservation:', err);
    }
  };

  const handleBoundaryUpdate = async (maxReservations: number) => {
    try {
      console.log('[DHCP] Updating boundary to:', maxReservations);
      await updatePoolBoundary(maxReservations);
      console.log('[DHCP] Boundary updated, reloading data...');
      await loadData();
      console.log('[DHCP] Data reloaded after boundary update');
    } catch (err) {
      console.error('[DHCP] Failed to update boundary:', err);
      throw err;
    }
  };

  const handleAddReservationFromSlider = async (mac: string, ip: string) => {
    try {
      await addReservation(mac, ip);
      await loadData();
    } catch (err) {
      console.error('Failed to add reservation:', err);
      throw err;
    }
  };

  return (
    <div className="dhcp-tablet">
      {statistics && (() => {
        console.log('[DHCP] Rendering banner with statistics:', {
          reservations_count: statistics.reservations_count,
          reservations_total: statistics.reservations_total,
          leases_count: statistics.leases_count,
          leases_total: statistics.leases_total
        });
        return (
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
              Hosts: <span className="dhcp-info-value">{statistics.leases_count}</span>
            </span>
            <span className="dhcp-info-separator">|</span>
            <span className="dhcp-info-item">
              Leases: <span className="dhcp-info-value">{statistics.leases_total}</span>
            </span>
          </div>
        );
      })()}
      <div className="dhcp-button-row">
        <button
          onClick={loadData}
          className="dhcp-action-button"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        <ReservationSlider
          statistics={statistics}
          currentReservations={reservations.length}
          currentHosts={statistics?.leases_count || 0}
          currentBoundary={currentBoundary}
          onBoundaryUpdate={handleBoundaryUpdate}
          onAddReservation={handleAddReservationFromSlider}
          isLoading={isLoading}
        />
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

