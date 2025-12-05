# DHCP Premium Tab

## Overview

The DHCP Premium Tab provides comprehensive DHCP management functionality for the homeserver platform. It allows administrators to view active DHCP leases, manage static IP reservations, and configure the Kea DHCP server through a web interface.

## Features

- **DHCP Lease Management**: View all active DHCP leases with IP addresses, MAC addresses, hostnames, and expiration times
- **Static IP Reservations**: Add and remove static IP reservations for specific devices
- **Configuration Management**: View and update Kea DHCP server configuration
- **Health Monitoring**: Check DHCP service status and configuration validity
- **Real-time Updates**: Refresh lease and reservation data on demand

## Requirements

- Kea DHCP server installed and configured
- Admin privileges required for all operations
- Kea DHCP configuration file at `/etc/kea/kea-dhcp4.conf`
- Lease database at `/var/lib/kea/kea-leases4.csv`

## API Endpoints

- `GET /api/dhcp/status` - Get DHCP service status
- `GET /api/dhcp/leases` - Get active DHCP leases
- `GET /api/dhcp/reservations` - Get static IP reservations
- `POST /api/dhcp/reservations` - Add new reservation
- `DELETE /api/dhcp/reservations/:id` - Remove reservation
- `GET /api/dhcp/config` - Get DHCP configuration
- `POST /api/dhcp/config` - Update DHCP configuration
- `GET /api/dhcp/health` - Health check endpoint

## Configuration

The tab is configured in `homeserver.patch.json` with:
- `displayName`: "DHCP"
- `adminOnly`: true
- `order`: 85

## Permissions

The tab requires sudo permissions for:
- Reading and writing Kea DHCP configuration file
- Setting file ownership and permissions
- Validating configuration
- Reading lease database

All permissions are defined in `permissions/flask-dhcp`.

## Installation

Install using the premium tab installer:

```bash
sudo python3 /var/www/homeserver/premium/installer.py install dhcp
```

## Usage

1. Navigate to the DHCP tab in the homeserver interface
2. View active leases in the "Leases" tab
3. Manage static IP reservations in the "Reservations" tab
4. View and update configuration in the "Configuration" tab
5. Check service health in the "Health Status" tab

## Development

For development iterations, use the reinstall command:

```bash
# Sync files to server
rsync -av --delete ./dhcp/ root@server:/var/www/homeserver/premium/dhcp/

# Reinstall
sudo python3 /var/www/homeserver/premium/installer.py reinstall dhcp
```

