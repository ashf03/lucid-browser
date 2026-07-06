"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Check, Trash2 } from "lucide-react"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card"
import { Tabs, TabsList, TabsTrigger } from "../../../ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../ui/alert-dialog"
import { Badge } from "../../../ui/badge"
import { Skeleton } from "../../../ui/skeleton"
import { ArrowsClockwise, ArrowsOutCardinal, Lock, Bell, Camera, Devices, DownloadSimple, Lightbulb, MapPin, Microphone, Panorama, SpeakerHigh, Usb, Vibrate, VideoCamera, X, CreditCard, Binoculars, PianoKeys, Database, Folder, MagnifyingGlass } from "@phosphor-icons/react";
import { HistoryItem } from "../../../lib/permissionLogic"
import { PermissionService } from "../../../lib/permissionService"

interface AdBlockerStatus {
  isEnabled: boolean;
  isInitialized: boolean;
}

interface AdBlockerStats {
  blockedCount: number;
}

// Map permission types to user-friendly names
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

interface PermissionSetting {
  origin: string
  permission: string
  status: string
}

interface SitePermissions {
  origin: string
  permissions: {
    permission: string
    status: string
  }[]
}

const PermissionsManager: React.FC = () => {
  const [sitePermissions, setSitePermissions] = useState<SitePermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "granted" | "denied">("all")

    const [status, setStatus] = useState<AdBlockerStatus>({ isEnabled: false, isInitialized: false });
    const [stats, setStats] = useState<AdBlockerStats>({ blockedCount: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

  // **NEW: Permission history state**
  const [permissionHistory, setPermissionHistory] = useState<HistoryItem[]>([]);

      useEffect(() => {
        loadStatus();
        loadStats();
      }, []);
    
      const loadStatus = async () => {
        try {
          const result = await (window as any).electronAPI.adBlocker.getStatus();
          setStatus(result);
        } catch (err) {
          console.error('Failed to load ad blocker status:', err);
          setError('Failed to load status');
        }
      };
    
      const loadStats = async () => {
        try {
          const result = await (window as any).electronAPI.adBlocker.getStats();
          setStats(result);
        } catch (err) {
          console.error('Failed to load ad blocker stats:', err);
        }
      };
    
      const toggleAdBlocker = async () => {
        setIsLoading(true);
        setError(null);
    
        try {
          let result;
          if (status.isEnabled) {
            result = await (window as any).electronAPI.adBlocker.disable();
          } else {
            result = await (window as any).electronAPI.adBlocker.enable();
          }
    
          if (result.success) {
            // Update status after successful toggle
            await loadStatus();
            await loadStats();
          } else {
            setError(result.error || 'Failed to toggle ad blocker');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          console.error('Failed to toggle ad blocker:', err);
        } finally {
          setIsLoading(false);
        }
      };

      const loadPermissions = async () => {
  try {
    setLoading(true);
    
    // Get all permissions from storage
    const permissions = await PermissionService.getAllPermissions();
    
    if (permissions && typeof permissions === 'object') {
      // Group permissions by origin using the service helper
      const grouped = PermissionService.groupPermissionsByOrigin(permissions);
      
      // Convert to the format expected by the component
      const sites: SitePermissions[] = Object.entries(grouped).map(([origin, permissions]) => ({
        origin,
        permissions
      }));
      
      console.log("Loaded permissions from storage:", sites);
      setSitePermissions(sites);
    } else {
      console.log("No permissions found in storage");
      setSitePermissions([]);
    }
  } catch (error) {
    console.error("Failed to load permissions:", error);
    setSitePermissions([]);
  } finally {
    setLoading(false);
  }
};

const loadPermissionHistory = async () => {
  try {
    const history = await PermissionService.getHistory();
    setPermissionHistory(history);
    console.log("Loaded permission history:", history.length, "items");
  } catch (error) {
    console.error('Failed to load permission history:', error);
  }
};

  // Load permissions on mount
  useEffect(() => {
    loadPermissions()
    loadPermissionHistory() // **NEW: Load permission history**
    
    // Implement a polling mechanism to periodically refresh permissions
    const pollingInterval = setInterval(() => {
      loadPermissions()
    }, 30000) // Check every 30 seconds
    
    // Cleanup on unmount
    return () => {
      clearInterval(pollingInterval)
    }
  }, [])

  // Filter sites
  const filteredSites = sitePermissions
    .filter((site) => {
      const matchesSearch = searchTerm === "" || site.origin.toLowerCase().includes(searchTerm.toLowerCase())

      // For filter status, check if any permission matches the filter
      const matchesFilter =
        filterStatus === "all" ||
        site.permissions.some(
          (p) =>
            (filterStatus === "granted" && p.status === "granted") ||
            (filterStatus === "denied" && p.status === "denied"),
        )

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => a.origin.localeCompare(b.origin))

const handleClearAllPermissions = async () => {
  try {
    const result = await PermissionService.clearAllPermissions();
    
    if (result.success) {
      // Update local state immediately
      setSitePermissions([]);
      
      // Reset search and filter
      setSearchTerm("");
      setFilterStatus("all");
      
      console.log("✅ All permissions cleared");
    } else {
      console.error("❌ Failed to clear permissions:", result.error);
      // Refresh to ensure UI is in sync
      await loadPermissions();
    }
  } catch (error) {
    console.error("❌ Error clearing permissions:", error);
    // Refresh to ensure UI is in sync
    await loadPermissions();
  }
};

const handleUpdatePermission = async (origin: string, permission: string, newStatus: string) => {
  try {
    const granted = newStatus === 'granted';
    const result = await PermissionService.savePermission(origin, permission, granted);
    
    if (result.success) {
      console.log(`✅ Updated permission: ${origin}:${permission} → ${newStatus}`);
      
      // Update local state immediately
      setSitePermissions(prevSites => {
        return prevSites.map(site => {
          if (site.origin === origin) {
            return {
              ...site,
              permissions: site.permissions.map(p => {
                if (p.permission === permission) {
                  return { ...p, status: newStatus };
                }
                return p;
              })
            };
          }
          return site;
        });
      });
    } else {
      console.error("❌ Failed to update permission:", result.error);
    }
  } catch (error) {
    console.error(`❌ Error updating permission ${permission} for ${origin}:`, error);
  }
};

const handleRemovePermission = async (origin: string, permission: string) => {
  try {
    const result = await PermissionService.deletePermission(origin, permission);
    
    if (result.success) {
      console.log(`✅ Removed permission: ${origin}:${permission}`);
      
      // Update local state immediately
      setSitePermissions(prevSites => {
        return prevSites.map(site => {
          if (site.origin === origin) {
            const updatedPermissions = site.permissions.filter(p => p.permission !== permission);
            return {
              ...site,
              permissions: updatedPermissions
            };
          }
          return site;
        }).filter(site => site.permissions.length > 0);
      });
    } else {
      console.error("❌ Failed to remove permission:", result.error);
    }
  } catch (error) {
    console.error(`❌ Error removing permission ${permission} for ${origin}:`, error);
  }
};

const handleRemoveSite = async (origin: string) => {
  try {
    const siteData = sitePermissions.find(site => site.origin === origin);
    
    if (siteData) {
      // Remove each permission for this site
      const deletePromises = siteData.permissions.map(perm => 
        PermissionService.deletePermission(origin, perm.permission)
      );
      
      const results = await Promise.all(deletePromises);
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        console.log(`✅ Removed all permissions for ${origin}`);
        
        // Update local state
        setSitePermissions(prevSites => 
          prevSites.filter(site => site.origin !== origin)
        );
      } else {
        console.error("❌ Some permissions failed to delete");
        // Refresh to ensure consistency
        await loadPermissions();
      }
    }
  } catch (error) {
    console.error(`❌ Error removing site ${origin}:`, error);
    await loadPermissions();
  }
};

const handleClearPermissionHistory = async () => {
  try {
    const result = await PermissionService.clearHistory();
    if (result.success) {
      setPermissionHistory([]);
      console.log("✅ Permission history cleared");
    } else {
      console.error("❌ Failed to clear history:", result.error);
    }
  } catch (error) {
    console.error('❌ Error clearing permission history:', error);
  }
};

  if (loading) {
    return (
      <div className="flex flex-col space-y-3 p-8">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-6 w-[300px]" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <Card className="shadow-none bg-transparent outline-none border-none">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Site Permissions</CardTitle>
          <CardDescription>Manage which sites can access your device features and data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 mb-6">
                        <div className="mt-4 border-b border-zinc-300 dark:border-zinc-800" />

                      <div className="mt-4">
                        <div className="py-4 flex justify-between items-center">
                          <div className="flex flex-col items-start">
                            <div className="flex flex-row justify-center items-center gap-2">
                                      <div 
          className={`w-3 h-3 rounded-full ${
            status.isEnabled 
              ? 'bg-green-500' 
              : status.isInitialized 
                ? 'bg-red-500' 
                : 'bg-gray-400'
          }`}
        />
                            <span className="text-foreground text-sm">Ads Blocker</span>
                            </div>
                          </div>
                          
        <Button
        onClick={toggleAdBlocker}
        disabled={isLoading}
                className={`
          px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
                          >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          status.isEnabled ? 'Disable' : 'Enable'
        )}
                          </Button>
                        </div>
                      </div>
                                  <div className="mt-4 border-b border-zinc-300 dark:border-zinc-800" />

            <div className="relative w-full">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by website..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-zinc-50/30"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Tabs
                defaultValue={filterStatus}
                onValueChange={(value) => setFilterStatus(value as "all" | "granted" | "denied")}
              >
                <TabsList className="bg-zinc-50/30">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="granted">Allowed</TabsTrigger>
                  <TabsTrigger value="denied">Blocked</TabsTrigger>
                </TabsList>
              </Tabs>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" size="sm">
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all permissions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All permission settings for all websites will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllPermissions}>Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {filteredSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <div className="text-3xl"><Lock /></div>
              </div>
              <h3 className="text-lg font-medium mb-1">No permissions found</h3>
              <p className="text-muted-foreground max-w-md">
                {searchTerm || filterStatus !== "all"
                  ? "No sites match your search or filter criteria."
                  : "No permissions have been saved yet."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>

<TableHeader>
  <TableRow>
    <TableHead className="w-[250px]">Website</TableHead>
    <TableHead>Permissions</TableHead>
    <TableHead className="w-[100px] text-center">Status</TableHead>
    <TableHead className="w-[80px] text-right">Actions</TableHead>
  </TableRow>
</TableHeader>
<TableBody>
  {filteredSites.map((site) => (
    <TableRow key={site.origin}>
      <TableCell className="font-medium truncate max-w-[250px]">{site.origin}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {site.permissions.map((perm, index) => (
            <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
              <span className="text-base">{getPermissionIcon(perm.permission)}</span>
              <span className="text-sm font-medium">{getPermissionName(perm.permission)}</span>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-wrap gap-2 justify-center">
          {site.permissions.map((perm, index) => (
            <Button 
              key={index}
              variant="ghost" 
              className="px-2 h-8"
              onClick={() => handleUpdatePermission(
                site.origin, 
                perm.permission, 
                perm.status === "granted" ? "denied" : "granted"
              )}
              title={perm.status === "granted" ? "Block permission" : "Allow permission"}
            >
              <Badge variant={perm.status === "granted" ? "default" : "destructive"}>
                {perm.status === "granted" ? "Allowed" : "Blocked"}
              </Badge>
            </Button>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <X />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove site permissions?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All permission settings for {site.origin} will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRemoveSite(site.origin)}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  ))}
</TableBody>
              </Table>
            </div>
          )}

          {/* **NEW: Permission History Section** */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Recent Permission Requests</h3>
              <Button variant="outline" size="sm" onClick={handleClearPermissionHistory}>
                Clear History
              </Button>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No recent permission requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissionHistory.slice(0, 10).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="flex items-center gap-2">
                          <span className="text-base">{getPermissionIcon(item.permission)}</span>
                          <span>{getPermissionName(item.permission)}</span>
                        </TableCell>
                        <TableCell>{item.origin}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.granted === null 
                              ? "secondary" 
                              : item.granted 
                                ? "default" 
                                : "destructive"
                          }>
                            {item.granted === null ? 'Pending' : item.granted ? 'Allowed' : 'Denied'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.timestamp}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PermissionsManager