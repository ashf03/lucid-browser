"use client"

import { ArrowsClockwise, ArrowsOutCardinal, Lock, Bell, Camera, Devices, DownloadSimple, Lightbulb, MapPin, Microphone, Panorama, SpeakerHigh, Usb, Vibrate, VideoCamera, X, CreditCard, Binoculars, PianoKeys, Database, Folder } from "@phosphor-icons/react"
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react"
import { PermissionRequest, sendPermissionResponse, getPermissionDetails, createHistoryItem } from '../../../lib/permissionLogic'
import { PermissionService } from "../../../lib/permissionService"

interface PermissionDialogProps {
  isOpen: boolean
  permissionRequest: PermissionRequest | null
  onClose: () => void
  onAllow: () => void
  onDeny: () => void
}

// Enhanced permission name mapping (keep your existing function)
const getPermissionName = (permission: string): string => {
  const normalizedPermission = permission.toLowerCase().trim()
  const permissionMap: Record<string, string> = {
    camera: "Camera",
    videoinput: "Camera",
    video: "Camera",
    "media-video": "Camera",
    "media:video": "Camera",
    microphone: "Microphone",
    audioinput: "Microphone",
    audio: "Microphone",
    "media-audio": "Microphone",
    "media:audio": "Microphone",
    media: "Media Devices",
    mediadevices: "Media Devices",
    geolocation: "Location",
    geo: "Location",
    notifications: "Notifications",
    notification: "Notifications",
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

  if (normalizedPermission in permissionMap) {
    return permissionMap[normalizedPermission]
  }

  for (const [key, value] of Object.entries(permissionMap)) {
    if (normalizedPermission.includes(key)) {
      return value
    }
  }

  return permission.charAt(0).toUpperCase() + permission.slice(1)
}

// Enhanced permission icon mapping (keep your existing function)
const getPermissionIcon = (permission: string): JSX.Element => {
  const normalizedPermission = permission.toLowerCase().trim()
  const iconMap: Record<string, JSX.Element> = {
    camera: <Camera />,
    videoinput: <VideoCamera />,
    video: <VideoCamera />,
    "media-video": <VideoCamera />,
    microphone: <Microphone />,
    audioinput: <Microphone />,
    audio: <SpeakerHigh />,
    "media-audio": <SpeakerHigh />,
    media: <Panorama />,
    mediadevices: <Devices />,
    geolocation: <MapPin />,
    geo: <MapPin />,
    notifications: <Bell />,
    "background-sync": <ArrowsClockwise />,
    accelerometer: <Vibrate />,
    gyroscope: <ArrowsOutCardinal />,
    "ambient-light-sensor": <Lightbulb />,
    downloads: <DownloadSimple />,
    usb: <Usb />,
    "payment-handler": <CreditCard />,
    "xr-spatial-tracking": <Binoculars />,
    midi: <PianoKeys />,
    storage: <Database />,
    "file-system": <Folder />,
  }

  if (normalizedPermission in iconMap) {
    return iconMap[normalizedPermission]
  }

  for (const [key, value] of Object.entries(iconMap)) {
    if (normalizedPermission.includes(key)) {
      return value
    }
  }

  return <Lock />
}

// Function to get more detailed permission description (keep your existing function)
const getPermissionDescription = (permission: string, origin: string): string => {
  const permName = getPermissionName(permission)
  const descriptions: Record<string, string> = {
    Camera: `Allow ${origin} to use your camera`,
    Microphone: `Allow ${origin} to use your microphone`,
    "Media Devices": `Allow ${origin} to access your camera and/or microphone`,
    Location: `Allow ${origin} to know your location`,
    Notifications: `Allow ${origin} to send you notifications`,
    "USB Devices": `Allow ${origin} to access USB devices`,
    "MIDI Devices": `Allow ${origin} to access MIDI devices`,
    "File System": `Allow ${origin} to access files on your device`,
    "Background Sync": `Allow ${origin} to update when you're not using it`,
    "Motion Sensors": `Allow ${origin} to access motion sensors`,
    "Payment Handler": `Allow ${origin} to process payments`,
    "VR/AR": `Allow ${origin} to access VR/AR features`,
  }

  return descriptions[permName] || `Allow ${origin} to use ${permName.toLowerCase()}`
}

export function PermissionDialog({ isOpen, permissionRequest, onClose, onAllow, onDeny }: PermissionDialogProps) {
  const [visible, setVisible] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Reset visibility when the dialog prop changes
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    }
  }, [isOpen, permissionRequest]);

  // **NEW: Keyboard shortcuts**
  useEffect(() => {
    if (!isOpen || !permissionRequest) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key.toLowerCase() === 'd' || e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      } else if (e.key === '2' || e.key.toLowerCase() === 'a' || e.key === 'Enter') {
        e.preventDefault();
        handleAllow();
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowDetails(!showDetails);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, permissionRequest, showDetails]);

  useEffect(() => {
    if (isOpen && permissionRequest) {
      console.log(`Dialog opened for permission: ${permissionRequest.permission} from ${permissionRequest.origin}`)
    }
  }, [isOpen, permissionRequest])

  if (!permissionRequest || !isOpen || !visible) return null

  const { permission, origin } = permissionRequest
  const permissionName = getPermissionName(permission)
  const permissionIcon = getPermissionIcon(permission)
  const description = getPermissionDescription(permission, origin)

const handleAllow = async () => {
  console.log('✅ Allow button clicked');
  
  if (!permissionRequest) return;
  
  try {
    // Save permission to storage
    const result = await PermissionService.savePermission(
      permissionRequest.origin,
      permissionRequest.permission,
      true
    );
    
    if (result.success) {
      console.log('✅ Permission saved to storage');
      
      // Send response to the original request (if needed for immediate response)
      const success = sendPermissionResponse(permissionRequest, true);
      if (success) {
        onAllow(); // Call original callback
      }
    } else {
      console.error('❌ Failed to save permission:', result.error);
      // Still call the callback even if storage failed
      onAllow();
    }
  } catch (error) {
    console.error('❌ Error saving permission:', error);
    // Still call the callback even if storage failed
    onAllow();
  }
};

const handleDeny = async () => {
  console.log('❌ Deny button clicked');
  
  if (!permissionRequest) return;
  
  try {
    // Save permission to storage
    const result = await PermissionService.savePermission(
      permissionRequest.origin,
      permissionRequest.permission,
      false
    );
    
    if (result.success) {
      console.log('✅ Permission denial saved to storage');
      
      // Send response to the original request (if needed for immediate response)
      const success = sendPermissionResponse(permissionRequest, false);
      if (success) {
        onDeny(); // Call original callback
      }
    } else {
      console.error('❌ Failed to save permission denial:', result.error);
      // Still call the callback even if storage failed
      onDeny();
    }
  } catch (error) {
    console.error('❌ Error saving permission denial:', error);
    // Still call the callback even if storage failed
    onDeny();
  }
};

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    console.log(`Dialog visually hidden without decision for: ${permission} from ${origin}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bbg-zinc-50/50 border-none dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-2xl text-zinc-50 mr-4">{permissionIcon}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-50 dark:text-gray-100">{permissionName} Permission</h3>
            <p className="text-sm text-zinc-50/80">{description}</p>
          </div>
          <button
            className="text-2xl text-zinc-50 rounded-full h-8 w-8 flex items-center justify-center transition-colors"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2">
          <div className="flex mb-1 items-center">
            <span className="text-sm text-zinc-50 font-medium">Source:</span>
            <span className="ml-2 text-sm font-medium text-blue-200/80">{origin}</span>
          </div>
          <p className="text-sm text-zinc-50">Your decision will be saved for future requests from {origin}</p>
          
          {/* **NEW: Details Toggle Button** */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-2 text-xs text-blue-200/80 hover:text-blue-200 underline"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>

          {/* **NEW: Permission Details** */}
          {showDetails && (
            <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-zinc-50 mb-2">Permission Details:</h4>
              <ul className="text-xs text-zinc-50/70 space-y-1">
                {getPermissionDetails(permissionRequest).map((detail: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined, index: Key | null | undefined) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-200/80 mr-2">•</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* **NEW: Screen Share Warning** */}
          {permission === 'display-capture' && (
            <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="text-xs text-orange-200">
                <strong>🖥️ Screen Sharing:</strong> This will allow the website to see and record everything on your screen.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-zinc-900 text-zinc-50 rounded-lg hover:bg-zinc-900/80 transition-all duration-200 font-medium"
            onClick={handleDeny}
          >
            {permission === 'display-capture' ? "Don't Share" : 'Block'}
          </button>
          <button
            className="px-4 py-2 bg-zinc-50 text-zinc-950 rounded-lg hover:bg-zinc-50/80 transition-all duration-200 shadow-sm hover:shadow font-medium"
            onClick={handleAllow}
          >
            {permission === 'display-capture' ? 'Share Screen' : 'Allow'}
          </button>
        </div>

        {/* **NEW: Keyboard Shortcuts Hint** */}
        <div className="px-5 pb-2">
          <div className="text-xs text-zinc-50/50 text-center">
            Press <span className="bg-zinc-50/10 px-1 rounded">D</span> to deny • <span className="bg-zinc-50/10 px-1 rounded">A</span> to allow • <span className="bg-zinc-50/10 px-1 rounded">I</span> for details
          </div>
        </div>
      </div>
    </div>
  )
}

export default PermissionDialog