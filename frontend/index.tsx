import React, { useState, useEffect } from 'react';
import './PortalCard.css';
import { DhcpLease, DhcpReservation, DhcpStatus, HealthStatus } from './types';
import { DhcpCard } from './components/DhcpCard';
import { useDhcpControls } from './hooks/useDhcpControls';

const DhcpTablet: React.FC = () => {
  const {
    getStatus,
    getLeases,
    getReservations,
    addReservation,
    removeReservation,
    getConfig,
    checkHealth,
    isLoading,
    error
  } = useDhcpControls();

  const [status, setStatus] = useState<DhcpStatus | null>(null);
  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'leases' | 'reservations' | 'config' | 'health'>('leases');
  const [showAddReservation, setShowAddReservation] = useState(false);
  const [newReservation, setNewReservation] = useState({
    'hw-address': '',
    'ip-address': '',
    hostname: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusData, leasesData, reservationsData] = await Promise.all([
        getStatus(),
        getLeases(),
        getReservations()
      ]);
      setStatus(statusData);
      setLeases(leasesData);
      setReservations(reservationsData);
    } catch (err) {
      console.error('Failed to load DHCP data:', err);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const health = await checkHealth();
      setHealthStatus(health);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const handleAddReservation = async () => {
    try {
      await addReservation(
        newReservation['hw-address'],
        newReservation['ip-address'],
        newReservation.hostname || undefined
      );
      setShowAddReservation(false);
      setNewReservation({ 'hw-address': '', 'ip-address': '', hostname: '' });
      await loadData();
    } catch (err) {
      console.error('Failed to add reservation:', err);
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

  const handleLoadConfig = async () => {
    try {
      const configData = await getConfig();
      setConfig(configData);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'config' && !config) {
      handleLoadConfig();
    }
  }, [activeTab]);

  return (
    <div className="dhcp-tablet">
      <div className="dhcp-tablet-header">
        <h2>DHCP Management</h2>
        <p className="dhcp-tablet-description">
          Manage DHCP leases, static IP reservations, and configuration
        </p>
        
        {status && (
          <div className="status-panel">
            <div className="status-info">
              <div className="status-item">
                <div className="status-item-label">Service Status</div>
                <div className={`status-item-value ${status.active ? 'active' : 'inactive'}`}>
                  {status.status}
                </div>
              </div>
              <div className="status-item">
                <div className="status-item-label">Active Leases</div>
                <div className="status-item-value">{leases.length}</div>
              </div>
              <div className="status-item">
                <div className="status-item-label">Reservations</div>
                <div className="status-item-value">{reservations.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="dhcp-tablet-nav">
        <button 
          className={`nav-button ${activeTab === 'leases' ? 'active' : ''}`}
          onClick={() => setActiveTab('leases')}
        >
          Leases
        </button>
        <button 
          className={`nav-button ${activeTab === 'reservations' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          Reservations
        </button>
        <button 
          className={`nav-button ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
        <button 
          className={`nav-button ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Health Status
        </button>
      </div>

      <div className="dhcp-tablet-content">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && (
          <div className="loading-banner">
            Loading...
          </div>
        )}

        {activeTab === 'leases' && (
          <div>
            <div className="dhcp-grid">
              {leases.length > 0 ? (
                leases.map((lease, index) => (
                  <DhcpCard
                    key={`${lease['ip-address']}-${index}`}
                    lease={lease}
                    type="lease"
                    className="lease-card"
                  />
                ))
              ) : (
                <p>No active DHCP leases found.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reservations' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setShowAddReservation(!showAddReservation)}
                className="primary-action"
                style={{ marginBottom: '16px' }}
              >
                {showAddReservation ? 'Cancel' : 'Add Reservation'}
              </button>

              {showAddReservation && (
                <div className="config-panel" style={{ marginBottom: '20px' }}>
                  <h3>Add Static IP Reservation</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        MAC Address:
                      </label>
                      <input
                        type="text"
                        value={newReservation['hw-address']}
                        onChange={(e) => setNewReservation({ ...newReservation, 'hw-address': e.target.value })}
                        placeholder="00:11:22:33:44:55"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        IP Address:
                      </label>
                      <input
                        type="text"
                        value={newReservation['ip-address']}
                        onChange={(e) => setNewReservation({ ...newReservation, 'ip-address': e.target.value })}
                        placeholder="192.168.123.10"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Hostname (optional):
                      </label>
                      <input
                        type="text"
                        value={newReservation.hostname}
                        onChange={(e) => setNewReservation({ ...newReservation, hostname: e.target.value })}
                        placeholder="device-name"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    <button
                      onClick={handleAddReservation}
                      className="primary-action"
                      disabled={!newReservation['hw-address'] || !newReservation['ip-address']}
                    >
                      Add Reservation
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="dhcp-grid">
              {reservations.length > 0 ? (
                reservations.map((reservation, index) => (
                  <DhcpCard
                    key={`${reservation['ip-address']}-${index}`}
                    reservation={reservation}
                    type="reservation"
                    onRemove={handleRemoveReservation}
                    className="reservation-card"
                  />
                ))
              ) : (
                <p>No static IP reservations configured.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-panel">
            <h3>DHCP Configuration</h3>
            {config ? (
              <div className="config-details">
                <div className="config-section">
                  <pre>{JSON.stringify(config, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p>Loading configuration...</p>
            )}
          </div>
        )}

        {activeTab === 'health' && (
          <div className="health-panel">
            <div className="health-header">
              <h3>Health Status</h3>
              <button 
                onClick={handleHealthCheck}
                disabled={isLoading}
                className="health-check-button"
              >
                {isLoading ? 'Checking...' : 'Run Health Check'}
              </button>
            </div>

            {healthStatus ? (
              <div className="health-details">
                <div className={`health-status ${healthStatus.status}`}>
                  <h4>Overall Status: {healthStatus.status.toUpperCase()}</h4>
                  {healthStatus.service && (
                    <p>Service: {healthStatus.service.status}</p>
                  )}
                  {healthStatus.config_valid !== undefined && (
                    <p>Config Valid: {healthStatus.config_valid ? 'Yes' : 'No'}</p>
                  )}
                </div>

                {healthStatus.error && (
                  <div className="health-error">
                    <h4>Error Details</h4>
                    <p>{healthStatus.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <p>Click &quot;Run Health Check&quot; to check system status</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DhcpTablet;

