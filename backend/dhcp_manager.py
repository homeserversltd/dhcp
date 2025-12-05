"""
DHCP Manager Utilities

Handles interaction with Kea DHCP server including configuration management,
lease queries, and reservation management.
"""

import json
import subprocess
import tempfile
import os
import csv
import time
from io import StringIO
from pathlib import Path
from typing import Dict, List, Optional, Any

class DhcpManager:
    """Manages Kea DHCP server operations."""
    
    CONFIG_PATH = Path("/etc/kea/kea-dhcp4.conf")
    LEASE_DB_PATH = Path("/var/lib/kea/kea-leases4.csv")
    
    def __init__(self):
        """Initialize DHCP manager."""
        self.config_path = self.CONFIG_PATH
        self.lease_db_path = self.LEASE_DB_PATH
    
    def _run_sudo_command(self, command: List[str]) -> tuple[bool, str]:
        """Execute a sudo command and return success status and output."""
        try:
            result = subprocess.run(
                ['/usr/bin/sudo'] + command,
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0, result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return False, "Command timed out"
        except Exception as e:
            return False, str(e)
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get DHCP service status."""
        success, output = self._run_sudo_command([
            'systemctl', 'is-active', 'kea-dhcp4-server'
        ])
        
        active = success and 'active' in output.lower()
        
        # Get service status details
        success_status, status_output = self._run_sudo_command([
            'systemctl', 'status', 'kea-dhcp4-server', '--no-pager'
        ])
        
        return {
            'active': active,
            'status': 'active' if active else 'inactive',
            'details': status_output if success_status else 'Unable to get status'
        }
    
    def get_config(self) -> Dict[str, Any]:
        """Read and return current DHCP configuration."""
        success, output = self._run_sudo_command([
            'cat', str(self.config_path)
        ])
        
        if not success:
            raise Exception(f"Failed to read config: {output}")
        
        # Extract JSON object from file (handles comments and extra data)
        # Find first { and last } to get the JSON object
        first_brace = output.find('{')
        last_brace = output.rfind('}')
        
        if first_brace == -1 or last_brace == -1 or last_brace <= first_brace:
            raise Exception("No valid JSON object found in config file")
        
        json_content = output[first_brace:last_brace + 1]
        
        try:
            return json.loads(json_content)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON in config file: {str(e)}")
    
    def update_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Update DHCP configuration file."""
        # Validate JSON structure
        try:
            json.dumps(config)
        except (TypeError, ValueError) as e:
            raise Exception(f"Invalid configuration JSON: {str(e)}")
        
        # Validate config before writing
        if not self._validate_config_structure(config):
            raise Exception("Invalid configuration structure")
        
        # Write to temp file first
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as tmp_file:
            tmp_path = tmp_file.name
            json.dump(config, tmp_file, indent=4)
        
        try:
            # Copy temp file to config location using dd (following flask-admin pattern)
            success, output = self._run_sudo_command([
                'dd', f'if={tmp_path}', f'of={self.config_path}', 'bs=1M'
            ])
            
            if not success:
                raise Exception(f"Failed to write config: {output}")
            
            # Set proper ownership and permissions
            self._run_sudo_command([
                'chown', '_kea:_kea', str(self.config_path)
            ])
            self._run_sudo_command([
                'chmod', '640', str(self.config_path)
            ])
            
            # Validate the written config
            if not self.validate_config():
                raise Exception("Configuration validation failed after write")
            
            # Reload service
            reload_success, reload_output = self._run_sudo_command([
                'systemctl', 'reload', 'kea-dhcp4-server'
            ])
            
            if not reload_success:
                raise Exception(f"Failed to reload service: {reload_output}")
            
            return self.get_config()
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def validate_config(self) -> bool:
        """Validate DHCP configuration file."""
        success, output = self._run_sudo_command([
            'kea-dhcp4', '-t', str(self.config_path)
        ])
        
        return success
    
    def _validate_config_structure(self, config: Dict[str, Any]) -> bool:
        """Validate that config has required structure."""
        if not isinstance(config, dict):
            return False
        
        if 'Dhcp4' not in config:
            return False
        
        dhcp4 = config['Dhcp4']
        if not isinstance(dhcp4, dict):
            return False
        
        if 'subnet4' not in dhcp4:
            return False
        
        return True
    
    def get_reservations(self) -> List[Dict[str, Any]]:
        """Get all static IP reservations from configuration."""
        config = self.get_config()
        reservations = []
        
        try:
            subnet4 = config.get('Dhcp4', {}).get('subnet4', [])
            for subnet in subnet4:
                subnet_reservations = subnet.get('reservations', [])
                for reservation in subnet_reservations:
                    reservations.append({
                        'hw-address': reservation.get('hw-address', ''),
                        'ip-address': reservation.get('ip-address', ''),
                        'hostname': reservation.get('hostname', '')
                    })
        except Exception as e:
            raise Exception(f"Error parsing reservations: {str(e)}")
        
        return reservations
    
    def add_reservation(self, hw_address: str, ip_address: str, hostname: Optional[str] = None) -> Dict[str, Any]:
        """Add a new static IP reservation."""
        config = self.get_config()
        
        # Validate IP and MAC format
        if not self._validate_ip_address(ip_address):
            raise Exception(f"Invalid IP address: {ip_address}")
        
        if not self._validate_mac_address(hw_address):
            raise Exception(f"Invalid MAC address: {hw_address}")
        
        # Check if reservation already exists
        existing = self.get_reservations()
        for res in existing:
            if res['hw-address'].lower() == hw_address.lower():
                raise Exception("Reservation with this MAC address already exists")
            if res['ip-address'] == ip_address:
                raise Exception("Reservation with this IP address already exists")
        
        # Add reservation to first subnet
        try:
            subnet4 = config.get('Dhcp4', {}).get('subnet4', [])
            if not subnet4:
                raise Exception("No subnet4 configuration found")
            
            subnet = subnet4[0]
            if 'reservations' not in subnet:
                subnet['reservations'] = []
            
            new_reservation = {
                'hw-address': hw_address.lower(),
                'ip-address': ip_address
            }
            
            if hostname:
                new_reservation['hostname'] = hostname
            
            subnet['reservations'].append(new_reservation)
            
            # Update config
            updated_config = self.update_config(config)
            
            # Return the new reservation
            return new_reservation
        except Exception as e:
            raise Exception(f"Failed to add reservation: {str(e)}")
    
    def remove_reservation(self, identifier: str) -> bool:
        """Remove a reservation by MAC address or IP address."""
        config = self.get_config()
        
        try:
            subnet4 = config.get('Dhcp4', {}).get('subnet4', [])
            for subnet in subnet4:
                if 'reservations' in subnet:
                    reservations = subnet['reservations']
                    # Remove matching reservation
                    original_count = len(reservations)
                    subnet['reservations'] = [
                        r for r in reservations
                        if r.get('hw-address', '').lower() != identifier.lower()
                        and r.get('ip-address', '') != identifier
                    ]
                    
                    if len(subnet['reservations']) < original_count:
                        # Reservation was removed, update config
                        self.update_config(config)
                        return True
            
            return False
        except Exception as e:
            raise Exception(f"Failed to remove reservation: {str(e)}")
    
    def get_leases(self) -> List[Dict[str, Any]]:
        """Get active DHCP leases from lease database."""
        leases = []
        
        # Try to read lease database
        if not self.lease_db_path.exists():
            return leases
        
        try:
            success, output = self._run_sudo_command([
                'cat', str(self.lease_db_path)
            ])
            
            if not success:
                return leases
            
            # Use dict keyed by MAC address to automatically deduplicate
            leases_by_mac = {}
            current_time = int(time.time())
            
            # Parse CSV lease database using proper CSV parser
            # Format: address,hwaddr,client_id,valid_lifetime,expire,subnet_id,fqdn_fwd,fqdn_rev,hostname,state,user_context
            csv_content = StringIO(output)
            reader = csv.DictReader(csv_content)
            
            for row in reader:
                # Only include active leases (state=0 and not expired)
                try:
                    expire_time = int(row['expire']) if row.get('expire') else 0
                    state = int(row['state']) if row.get('state') else 1
                except (ValueError, KeyError):
                    continue
                
                if state == 0 and expire_time > current_time:
                    mac = row.get('hwaddr', '')
                    if not mac:
                        continue
                    
                    # Keep the lease with the latest expiration time for each MAC
                    if mac not in leases_by_mac or expire_time > leases_by_mac[mac]['_expire']:
                        leases_by_mac[mac] = {
                            'ip-address': row.get('address', ''),
                            'hw-address': mac,
                            'hostname': row.get('hostname', ''),
                            'expire': str(expire_time),
                            'state': str(state),
                            '_expire': expire_time  # Internal field for comparison
                        }
            
            # Convert dict to list and remove internal expire field
            for lease in leases_by_mac.values():
                lease.pop('_expire', None)  # Remove internal field
                leases.append(lease)
                
        except Exception as e:
            # If we can't read leases, return empty list
            # This is not a critical error
            pass
        
        return leases
    
    def _validate_ip_address(self, ip: str) -> bool:
        """Validate IP address format."""
        try:
            parts = ip.split('.')
            if len(parts) != 4:
                return False
            for part in parts:
                num = int(part)
                if num < 0 or num > 255:
                    return False
            return True
        except (ValueError, AttributeError):
            return False
    
    def _validate_mac_address(self, mac: str) -> bool:
        """Validate MAC address format."""
        try:
            parts = mac.replace(':', '-').split('-')
            if len(parts) != 6:
                return False
            for part in parts:
                int(part, 16)
            return True
        except (ValueError, AttributeError):
            return False
    
    def _get_pool_range(self) -> tuple[Optional[str], Optional[str]]:
        """Extract IP pool range from configuration."""
        try:
            config = self.get_config()
            subnet4 = config.get('Dhcp4', {}).get('subnet4', [])
            if not subnet4:
                return None, None
            
            subnet = subnet4[0]
            pools = subnet.get('pools', [])
            if not pools:
                return None, None
            
            # Get first pool range
            pool_str = pools[0].get('pool', '')
            if ' - ' in pool_str:
                start_ip, end_ip = pool_str.split(' - ', 1)
                return start_ip.strip(), end_ip.strip()
            
            return None, None
        except Exception:
            return None, None
    
    def _ip_to_int(self, ip: str) -> Optional[int]:
        """Convert IP address to integer for comparison."""
        try:
            parts = ip.split('.')
            if len(parts) != 4:
                return None
            return int(parts[0]) * 256**3 + int(parts[1]) * 256**2 + int(parts[2]) * 256 + int(parts[3])
        except (ValueError, AttributeError):
            return None
    
    def _validate_ip_in_pool(self, ip: str) -> bool:
        """Validate IP address is within configured pool range."""
        if not self._validate_ip_address(ip):
            return False
        
        start_ip, end_ip = self._get_pool_range()
        if not start_ip or not end_ip:
            # If pool range can't be determined, just validate format
            return True
        
        ip_int = self._ip_to_int(ip)
        start_int = self._ip_to_int(start_ip)
        end_int = self._ip_to_int(end_ip)
        
        if ip_int is None or start_int is None or end_int is None:
            return False
        
        return start_int <= ip_int <= end_int
    
    def update_reservation_ip(self, identifier: str, new_ip: str) -> Dict[str, Any]:
        """Update a reservation's IP address."""
        config = self.get_config()
        
        # Validate new IP address
        if not self._validate_ip_address(new_ip):
            raise Exception(f"Invalid IP address format: {new_ip}")
        
        # Validate IP is within pool range
        if not self._validate_ip_in_pool(new_ip):
            start_ip, end_ip = self._get_pool_range()
            if start_ip and end_ip:
                raise Exception(f"IP address {new_ip} is outside the configured pool range ({start_ip} - {end_ip})")
            else:
                raise Exception(f"Could not validate IP address against pool range")
        
        # Check if new IP is already assigned to another reservation
        existing = self.get_reservations()
        for res in existing:
            if res['ip-address'] == new_ip:
                # Allow if it's the same reservation we're updating
                if res['hw-address'].lower() != identifier.lower() and res['ip-address'] != identifier:
                    raise Exception("IP address is already assigned to another reservation")
        
        # Find and update the reservation
        try:
            subnet4 = config.get('Dhcp4', {}).get('subnet4', [])
            found = False
            
            for subnet in subnet4:
                if 'reservations' in subnet:
                    for reservation in subnet['reservations']:
                        # Match by MAC or IP
                        if (reservation.get('hw-address', '').lower() == identifier.lower() or
                            reservation.get('ip-address', '') == identifier):
                            reservation['ip-address'] = new_ip
                            found = True
                            break
                    if found:
                        break
            
            if not found:
                raise Exception("Reservation not found")
            
            # Update config
            updated_config = self.update_config(config)
            
            # Return updated reservation
            updated_reservations = self.get_reservations()
            for res in updated_reservations:
                if res['hw-address'].lower() == identifier.lower() or res['ip-address'] == new_ip:
                    return res
            
            raise Exception("Failed to retrieve updated reservation")
        except Exception as e:
            raise Exception(f"Failed to update reservation: {str(e)}")

