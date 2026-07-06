import React, { useEffect, useState, useCallback } from 'react';
import { Gear } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Button } from '../../../ui/button';
import { ScrollArea } from '../../../ui/scroll-area';
import { cn } from '../../../lib/utils';
import { ArrowsClockwise, ArrowsOutCardinal, Lock, Bell, Camera, Devices, DownloadSimple, Lightbulb, MapPin, Microphone, Panorama, SpeakerHigh, Usb, Vibrate, VideoCamera, X, CreditCard, Binoculars, PianoKeys, Database, Folder } from "@phosphor-icons/react"
import { HistoryItem } from '../../../lib/permissionLogic';
import { PermissionService } from '../../../lib/permissionService';

// Function to normalize origins consistently with the backend
const normalizeOrigin = (originStr: string): string => {
  // If it's already a normalized string without protocol, return as is
  if (!originStr.includes('://')) {
    return originStr;
  }
  
  try {
    // Parse the URL and extract just the hostname and port if present
    const url = new URL(originStr);
    return url.hostname + (url.port ? `:${url.port}` : '');
  } catch (e) {
    // If parsing fails, return the original string
    console.error(`Failed to normalize origin: ${originStr}`, e);
    return originStr;
  }
};

const getPermissionName = (permission: string): string => {
  // Normalize permission string to handle various formats
  const normalizedPermission = permission.toLowerCase().trim()

  // Map different variants of the same permission to a single name
  const permissionMap: Record<string, string> = {
    // Camera permissions
    camera: "Camera",
    videoinput: "Camera",
    video: "Camera",
    "media-video": "Camera",
    "media:video": "Camera",

    // Microphone permissions
    microphone: "Microphone",
    audioinput: "Microphone",
    audio: "Microphone",
    "media-audio": "Microphone",
    "media:audio": "Microphone",

    // Media permissions (could be either camera, microphone, or both)
    media: "Media Devices", // Generic media could be both camera and mic
    mediadevices: "Media Devices",

    // Location permissions
    geolocation: "Location",
    geo: "Location",

    // Notifications
    notifications: "Notifications",
    notification: "Notifications",

    // Other common permissions
    "background-sync": "Background Sync",
    accelerometer: "Motion Sensors",
    gyroscope: "Motion Sensors",
    "ambient-light-sensor": "Light Sensor",
    downloads: "Automatic Downloads",
    usb: "USB Devices",
    "payment-handler": "Payment Handler",
    "xr-spatial-tracking": "VR/AR",
    midi: "MIDI Devices",
    storage: "File System",
    "file-system": "File System",
  }

  // Check if we have a direct match in our map
  if (normalizedPermission in permissionMap) {
    return permissionMap[normalizedPermission]
  }

  // Check for partial matches (e.g., if permission contains 'camera')
  for (const [key, value] of Object.entries(permissionMap)) {
    if (normalizedPermission.includes(key)) {
      return value
    }
  }

  // If no match found, just capitalize the first letter
  return permission.charAt(0).toUpperCase() + permission.slice(1)
}

// Enhanced permission icon mapping
const getPermissionIcon = (permission: string): JSX.Element => {
  // Normalize permission string to handle various formats
  const normalizedPermission = permission.toLowerCase().trim()

  // Map of permissions to icons
  const iconMap: Record<string, JSX.Element> = {
    // Camera permissions
    camera: <Camera /> ,
    videoinput: <VideoCamera />,
    video: <VideoCamera />,
    "media-video": <VideoCamera />,

    // Microphone permissions
    microphone:<Microphone />,
    audioinput:<Microphone />,
    audio: <SpeakerHigh />,
    "media-audio": <SpeakerHigh />,

    // Combined media
    media: <Panorama />, // Generic icon for media permissions
    mediadevices: <Devices />,

    // Location
    geolocation: <MapPin />,
    geo: <MapPin />,

    // Other permissions
    notifications: <Bell />,
    "background-sync": <ArrowsClockwise />,
    accelerometer: <Vibrate />,
    gyroscope: <ArrowsOutCardinal />,
    "ambient-light-sensor": <Lightbulb />,
    downloads: <DownloadSimple />,
    usb: <Usb />,
    "payment-handler": <CreditCard />,
    "xr-spatial-tracking": <Binoculars  />,
    midi: <PianoKeys />,
    storage: <Database />,
    "file-system": <Folder />,
  }

  // Direct match
  if (normalizedPermission in iconMap) {
    return iconMap[normalizedPermission]
  }

  // Partial match
  for (const [key, value] of Object.entries(iconMap)) {
    if (normalizedPermission.includes(key)) {
      return value
    }
  }

  // Default icon for unknown permissions
  return <Lock />
}

interface PermissionInfo {
  permission: string;
  status: string;
}

interface PermissionStatusIndicatorProps {
  activeTabUrl: string;
  activeTabId: string;
}

const PermissionStatusIndicator: React.FC<PermissionStatusIndicatorProps> = ({ 
  activeTabUrl, 
  activeTabId 
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'mixed' | 'none'>('none');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sitePermissions, setSitePermissions] = useState<PermissionInfo[]>([]);
  const [origin, setOrigin] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  
  // **NEW: Recent permission history state**
  const [recentPermissions, setRecentPermissions] = useState<HistoryItem[]>([]);

const checkPermissionStatus = useCallback(async () => {
  setIsLoading(true);
  
  try {
    // Extract origin from URL
    let currentOrigin = '';
    let displayOrigin = '';
    try {
      if (activeTabUrl && !activeTabUrl.startsWith('data:') && !activeTabUrl.startsWith('about:')) {
        const url = new URL(activeTabUrl);
        displayOrigin = url.origin;
        currentOrigin = normalizeOrigin(displayOrigin);
        setOrigin(displayOrigin);
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
      setPermissionStatus('none');
      setSitePermissions([]);
      setIsLoading(false);
      return;
    }
    
    if (!currentOrigin) {
      setPermissionStatus('none');
      setSitePermissions([]);
      setIsLoading(false);
      return;
    }
    
    console.log(`Checking permissions for origin: ${currentOrigin}`);
    
    // Get all permissions using the service
    const allPermissions = await PermissionService.getAllPermissions();
    
    if (!allPermissions) {
      setPermissionStatus('none');
      setSitePermissions([]);
      setIsLoading(false);
      return;
    }
    
    // Filter permissions for this origin
    let hasGranted = false;
    let hasDenied = false;
    const permissionsForSite: PermissionInfo[] = [];
    
    Object.entries(allPermissions).forEach(([key, value]) => {
      if (key.startsWith(`${currentOrigin}:`)) {
        const permissionType = key.split(':')[1];
        console.log(`Found permission: ${key} = ${value}`);
        
        permissionsForSite.push({
          permission: permissionType,
          status: value
        });
        
        if (value === 'granted') {
          hasGranted = true;
        } else if (value === 'denied') {
          hasDenied = true;
        }
      }
    });
    
    setSitePermissions(permissionsForSite);
    
    // Determine overall status
    if (hasGranted && hasDenied) {
      setPermissionStatus('mixed');
    } else if (hasGranted) {
      setPermissionStatus('granted');
    } else if (hasDenied) {
      setPermissionStatus('denied');
    } else {
      setPermissionStatus('none');
    }
    
    console.log(`Permission status for ${currentOrigin}: ${permissionStatus}`);
  } catch (error) {
    console.error('Error checking permission status:', error);
    setPermissionStatus('none');
    setSitePermissions([]);
  } finally {
    setIsLoading(false);
  }
}, [activeTabUrl, activeTabId]);

const loadRecentPermissions = useCallback(async () => {
  try {
    const history = await PermissionService.getHistory();
    const recentItems = history.slice(0, 5).map(item => ({
      permission: item.permission,
      origin: item.origin,
      granted: item.granted,
      timestamp: 'Recent'
    }));
    setRecentPermissions(recentItems);
  } catch (error) {
    console.error('Failed to load recent permissions:', error);
  }
}, []);

  // Run permission check when tab changes
  useEffect(() => {
    checkPermissionStatus();
    loadRecentPermissions(); // **NEW: Load recent permissions**
  }, [checkPermissionStatus, loadRecentPermissions]);
  
  // Listen for permission changes from anywhere in the application
  useEffect(() => {
    const handlePermissionsChanged = () => {
      console.log('Permission changed event received in PermissionStatusIndicator');
      checkPermissionStatus();
      loadRecentPermissions(); // **NEW: Reload recent permissions**
    };
    
    // Add event listener for the custom permissions-changed event
    document.addEventListener('permissions-changed', handlePermissionsChanged);
    
    // Clean up function
    return () => {
      document.removeEventListener('permissions-changed', handlePermissionsChanged);
    };
  }, [checkPermissionStatus, loadRecentPermissions]);
  
  if (isLoading || permissionStatus === 'none') {
    return null;
  }
  
  // Determine color based on status
  const lineColor = 
    permissionStatus === 'granted' ? 'bg-green-500' :
    permissionStatus === 'denied' ? 'bg-red-500' :
    permissionStatus === 'mixed' ? 'bg-yellow-500' : 'hidden';

  const statusText = 
    permissionStatus === 'granted' ? 'Allowed permissions' :
    permissionStatus === 'denied' ? 'Blocked permissions' :
    permissionStatus === 'mixed' ? 'Mixed permissions' : '';
  
  const openPermissionsSettings = () => {
    // Match exactly how the history button works in TopNavBar
    window.dispatchEvent(new CustomEvent('openSettingsDialog', {
      detail: { 
        selectedTab: 2 // Data tab (which contains permissions)
      }
    }));
    setIsOpen(false);
  };
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative cursor-pointer">
          <div 
            className={`${lineColor} w-0.5 h-2.5 inline-block right-3 relative`}
            title={`${statusText} for ${origin}`}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-72 border-none ml-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg app-region-no-drag"
        align="end"
      > 
        <ScrollArea className="h-auto max-h-60">
          {sitePermissions.length > 0 ? (
            <div className="p-1">
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Permissions for {origin}
              </div>
              {sitePermissions.map((item, index) => (
                <div key={index} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <div className="flex items-center">
                    <span className="mr-2">{getPermissionIcon(item.permission)}</span>
                    <span className="flex-1 text-sm">{getPermissionName(item.permission)}</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      item.status === 'granted' 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    )}>
                      {item.status === 'granted' ? 'Allowed' : 'Blocked'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No permissions set for this site
            </div>
          )}

          {/* **NEW: Recent Permissions Section** */}
          {recentPermissions.length > 0 && (
            <div className="border-t p-1">
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Recent Requests
              </div>
              {recentPermissions.map((item, index) => (
                <div key={index} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <div className="flex items-center">
                    <span className="mr-2">{getPermissionIcon(item.permission)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{getPermissionName(item.permission)}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.origin}</div>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded ml-2 flex-shrink-0",
                      item.granted === null 
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : item.granted 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    )}>
                      {item.granted === null ? 'Pending' : item.granted ? 'Allowed' : 'Denied'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button 
            onClick={openPermissionsSettings}
            className="w-full text-xs h-8 flex items-center justify-center gap-1.5"
            variant="outline"
          >
            <Gear size={14} weight="bold" />
            <span>Manage Permissions</span>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PermissionStatusIndicator;