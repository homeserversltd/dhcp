# DHCP Premium Tab

## Overview

The DHCP Premium Tab is an add-on module for the homeserver platform that provides comprehensive DHCP management functionality. It integrates with the Kea DHCP server to provide a unified interface for viewing active DHCP leases, managing static IP reservations, and configuring network address allocation.

## Features

### Unified Device View
- **Combined Display**: Shows both static IP reservations (pinned devices) and active DHCP leases (hosts) in a single unified list
- **Visual Distinction**: Reservations are marked as "PINNED" to distinguish them from temporary leases
- **Automatic Deduplication**: Leases that have corresponding reservations are automatically filtered from the lease list

### Static IP Reservation Management
- **Auto-Assignment**: When pinning a lease to create a reservation, IP addresses are automatically assigned from the reserved range (192.168.123.2 - 192.168.123.49) in descending order
- **Manual IP Editing**: Edit IP addresses for existing reservations (must be within reserved range)
- **MAC-Based Operations**: Reservations can be added, updated, or removed by MAC address or IP address
- **Hostname Preservation**: Hostnames from leases are automatically preserved when creating reservations

### Pool Boundary Management
- **Dynamic Allocation**: Adjust the boundary between reserved IP range and DHCP pool range using an interactive slider
- **Capacity Calculation**: Automatically calculates maximum reservations based on current pool configuration
- **Validation**: Ensures boundary changes don't conflict with existing reservations or leases
- **Real-time Updates**: Boundary changes immediately update the Kea DHCP configuration

### Statistics Dashboard
- **Network Overview**: Displays homeserver IP address, current reservation count vs. maximum, and active host count vs. pool capacity
- **Capacity Monitoring**: Real-time tracking of reservation and lease utilization
- **Boundary Information**: Shows current maximum reservations setting

### Lease Management
- **Active Lease Viewing**: View all active DHCP leases with IP addresses, MAC addresses, hostnames, and expiration times
- **Lease-to-Reservation Conversion**: One-click pinning converts temporary leases to permanent reservations
- **Automatic Filtering**: Leases for devices with existing reservations are automatically excluded from the display

## Architecture

### IP Address Allocation Model

The DHCP tab implements a two-tier IP allocation system:

1. **Reserved Range** (192.168.123.2 - 192.168.123.X): Static IP reservations for devices that require fixed addresses
2. **Pool Range** (192.168.123.(X+1) - 192.168.123.250): Dynamic DHCP pool for temporary lease assignments

The boundary between these ranges is configurable and determines the maximum number of reservations allowed. The pool range automatically adjusts based on the boundary setting.

### Auto-Assignment Algorithm

When creating a reservation without specifying an IP address (or if the provided IP is in the pool range), the system:
1. Checks existing reservations to find used IPs
2. Searches the reserved range in descending order (49 → 2)
3. Assigns the first available IP address
4. Validates the assignment is within the reserved range

## Requirements

- Kea DHCP server installed and configured
- Admin privileges required for all operations
- Kea DHCP configuration file at `/etc/kea/kea-dhcp4.conf`
- Lease database at `/var/lib/kea/kea-leases4.csv`
- Atomic update script at `/usr/local/sbin/update-kea-dhcp.sh` for safe configuration updates

## API Endpoints

### Service Management
- `GET /api/dhcp/status` - Get DHCP service status (active/inactive)
- `GET /api/dhcp/health` - Health check endpoint (service status + config validation)

### Lease Operations
- `GET /api/dhcp/leases` - Get all active DHCP leases (deduplicated by MAC address)

### Reservation Operations
- `GET /api/dhcp/reservations` - Get all static IP reservations
- `POST /api/dhcp/reservations` - Add new reservation (auto-assigns IP if not provided)
  - Body: `{ "hw-address": "mac:address", "ip-address": "optional", "hostname": "optional" }`
- `PUT /api/dhcp/reservations/<identifier>` - Update reservation IP address
  - Body: `{ "ip-address": "new.ip.address" }`
- `DELETE /api/dhcp/reservations/<identifier>` - Remove reservation (by MAC or IP)

### Configuration Management
- `GET /api/dhcp/config` - Get current Kea DHCP configuration
- `POST /api/dhcp/config` - Update Kea DHCP configuration
  - Body: `{ "config": { ... } }`

### Statistics and Boundary
- `GET /api/dhcp/statistics` - Get network statistics (homeserver IP, reservation/lease counts)
- `GET /api/dhcp/pool-boundary` - Get current maximum reservations setting
- `POST /api/dhcp/pool-boundary` - Update pool boundary (adjust reservations-to-hosts ratio)
  - Body: `{ "max_reservations": <number> }`

## Configuration

The tab is configured in `homeserver.patch.json` with:
- `displayName`: "DHCP"
- `adminOnly`: true
- `order`: 85

## Permissions

The tab requires sudo permissions for:
- Reading and writing Kea DHCP configuration file (`/etc/kea/kea-dhcp4.conf`)
- Executing atomic update script (`/usr/local/sbin/update-kea-dhcp.sh`)
- Reading lease database (`/var/lib/kea/kea-leases4.csv`)
- Validating configuration (`kea-dhcp4 -t`)
- Checking service status (`systemctl`)

All permissions are defined in `permissions/flask-dhcp`.

## Installation

Install using the premium tab installer:

```bash
sudo python3 /var/www/homeserver/premium/installer.py install dhcp
```

## Usage

### Basic Workflow

1. **View Network Devices**: Navigate to the DHCP tab to see all active leases and reservations in a unified list
2. **Pin a Device**: Click the "PINNED" button on any lease to convert it to a permanent reservation with auto-assigned IP
3. **Edit IP Address**: Click "Edit IP" on a reservation to manually assign a specific IP (must be in reserved range)
4. **Remove Reservation**: Click "Remove" to unpin a device and return it to the DHCP pool
5. **Adjust Capacity**: Use the "Configure Reservations/Hosts Ratio" slider to adjust the boundary between reserved and pool ranges
6. **Refresh Data**: Click "Refresh" to reload all lease and reservation data

### Statistics Banner

The top banner displays:
- **Homeserver IP**: The router/gateway IP address
- **Reservations**: Current count vs. maximum allowed (based on boundary setting)
- **Hosts**: Current active leases vs. pool capacity

### Pool Boundary Configuration

The boundary slider allows you to:
- Increase maximum reservations (reduces pool size)
- Decrease maximum reservations (increases pool size)
- Automatically validates that changes don't conflict with existing reservations

## Technical Details

### Configuration Update Process

Configuration updates use an atomic update mechanism:
1. Validate JSON structure and required fields
2. Write new configuration to temporary file
3. Execute atomic update script via sudo
4. Script validates configuration before applying
5. On success, replaces old configuration atomically
6. On failure, preserves existing configuration

### Lease Database Parsing

The lease database is a CSV file with the following format:
- Fields: `address`, `hwaddr`, `client_id`, `valid_lifetime`, `expire`, `subnet_id`, `fqdn_fwd`, `fqdn_rev`, `hostname`, `state`, `user_context`
- Only active leases (`state=0`) with future expiration times are included
- Duplicate MAC addresses are deduplicated (keeps lease with latest expiration)

## Development

For development iterations, use the reinstall command:

```bash
# Sync files to server
rsync -av --delete ./dhcp/ root@server:/var/www/homeserver/premium/dhcp/

# Reinstall
sudo python3 /var/www/homeserver/premium/installer.py reinstall dhcp
```

## Integration with Homeserver Platform

This tab integrates with the homeserver platform's premium tab system:
- Uses the standard premium tab installer for deployment
- Follows homeserver's permission model (sudo-based operations)
- Integrates with homeserver's admin authentication system
- Uses homeserver's standard API response format (`{ success: boolean, ... }`)

