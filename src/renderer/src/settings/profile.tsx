import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronUp, LogOut, Trash2, Camera, Save } from 'lucide-react';
import { Key } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { useAuth } from '../Auth/AuthContext';
import { useView } from '../components/parts/ViewContext';
import Avvvatars from 'avvvatars-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';

const Profile = () => {
  // Get auth context for user data - NOW INCLUDING changePassword
  const { user, profile, signOut, updateProfile, uploadAvatar, changePassword } = useAuth();
  
  // Get view context for webview management
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();
  
  // State for parental controls
  const [isParentalOpen, setIsParentalOpen] = useState(true);
  const [parentalEnabled, setParentalEnabled] = useState(true);
  const [nsfwEnabled, setNsfwEnabled] = useState(true);
  const [profanityEnabled, setProfanityEnabled] = useState(true);
  
  // State for profile editing
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  
  // State for avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  
  // State for password change dialog
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  
  // State for account deletion dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  // State to track the current theme
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');
  
  // Set initial display name when profile loads
  useEffect(() => {
    if (profile?.name) {
      setDisplayName(profile.name);
    }
  }, [profile]);
  
  // Function to get the effective theme (resolves 'system' to actual theme)
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  
  // Handler for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = () => {
      if (theme === 'system') {
        const effectiveTheme = mediaQuery.matches ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', mediaQuery.matches);
        window.electronAPI.theme.change('system').catch(console.error);
      }
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme]);
  
  // Initial theme setup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await window.electronAPI.store.get('theme');
        const validatedTheme = (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') 
          ? savedTheme
          : 'system';
        
        setTheme(validatedTheme);
        const effectiveTheme = validatedTheme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : validatedTheme;
        
        document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
        await window.electronAPI.theme.change(validatedTheme);
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    
    loadTheme();
  }, []);
  
  // Function to update the theme
  const handleThemeChange = async (newTheme: 'dark' | 'light' | 'system') => {
    try {
      setTheme(newTheme);
      const effectiveTheme = newTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : newTheme;
      
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
      await window.electronAPI.theme.change(newTheme);
      await window.electronAPI.store.set('theme', newTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };
  
  // Handle saving the display name
  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setNameError('Display name cannot be empty');
      return;
    }
    
    if (displayName === profile?.name) {
      // No change, just return
      return;
    }
    
    setNameError('');
    setIsSavingName(true);
    
    try {
      const { success, error } = await updateProfile({ name: displayName });
      
      if (!success) {
        throw error;
      }
    } catch (error) {
      setNameError((error as Error)?.message || 'Failed to update name');
      console.error('Error updating name:', error);
    } finally {
      setIsSavingName(false);
    }
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Upload avatar file to storage
  const uploadAvatarFile = async (file: File) => {
    setAvatarError('');
    setIsUploadingAvatar(true);
    
    try {
      const { success, url, error } = await uploadAvatar(file);
      
      if (!success || !url) {
        throw error || new Error('Failed to upload avatar');
      }
      
      // Success, avatar URL is automatically updated in profile state
    } catch (error) {
      setAvatarError((error as Error)?.message || 'Failed to upload avatar');
      console.error('Error uploading avatar:', error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };
  
  // Password validation function
  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters long' };
    }
    
    return { isValid: true, message: '' };
  };
  
  // UPDATED: Handle password change with proper implementation
  const handlePasswordChange = async () => {
    console.log('🔄 Password change initiated');
    
    // Reset error and success states
    setPasswordError('');
    setPasswordChangeSuccess(false);
    
    // Validation
    if (!oldPassword.trim()) {
      console.log('❌ Current password missing');
      setPasswordError('Current password is required');
      return;
    }
    
    if (!newPassword.trim()) {
      console.log('❌ New password missing');
      setPasswordError('New password is required');
      return;
    }
    
    // Password validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      console.log('❌ Password validation failed:', passwordValidation.message);
      setPasswordError(passwordValidation.message);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      console.log('❌ Passwords do not match');
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (oldPassword === newPassword) {
      console.log('❌ New password same as old');
      setPasswordError('New password must be different from current password');
      return;
    }
    
    console.log('✅ Validation passed, starting password change');
    setIsChangingPassword(true);
    
    try {
      console.log('🔄 Calling changePassword function');
      const { success, error } = await changePassword(oldPassword, newPassword);
      
      console.log('🔄 Password change result:', { success, error: error?.message });
      
      if (!success) {
        throw error;
      }
      
      // Success - clear form and show success message
      console.log('✅ Password change successful');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setPasswordChangeSuccess(true);
      
      // Auto-close dialog after 2 seconds
      setTimeout(() => {
        setIsPasswordDialogOpen(false);
        setPasswordChangeSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Password change failed:', error);
      setPasswordError((error as Error)?.message || 'Failed to change password');
    } finally {
      console.log('🔄 Password change process completed');
      setIsChangingPassword(false);
    }
  };
  
  // Function to reset password dialog state
  const resetPasswordDialog = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordChangeSuccess(false);
    setIsChangingPassword(false);
  };
  
  // Handle account deletion - opens Google Form in webview
  const handleDeleteAccount = (e: React.MouseEvent) => {
    e.preventDefault();
    const deleteFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLScYkOCju91G9Ap1ny9uKJEigkG8fhu76JRX5SoBW68yyOSn2Q/viewform?usp=header";
    
    let processedUrl = deleteFormUrl;
    if (!deleteFormUrl.startsWith("http://") && !deleteFormUrl.startsWith("https://")) {
      processedUrl = `https://${deleteFormUrl}`;
    }
    
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          });
        })
        .catch((error) => {
          console.error("Failed to load delete account form:", error);
        });
    }
  };
  
const handleSignOut = async () => {
  try {
    await signOut();
    // Redirect will happen automatically due to auth state change
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

  const [avatarLoadError, setAvatarLoadError] = useState(false);

// Update the handleAvatarChange function to reset the error state
const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image too large (max 2MB)");
      return;
    }
    
    // Reset avatar load error state when a new file is selected
    setAvatarLoadError(false);
    
    // Upload avatar
    uploadAvatarFile(file);
  }
};

// Modify the useEffect that tracks the profile data to log more details
useEffect(() => {
  console.log("Profile data:", profile);
  setAvatarLoadError(false); // Reset error state when profile changes
  
  if (profile?.avatar_url) {
    console.log("Avatar URL:", profile.avatar_url);
    // Test if the URL is accessible
    fetch(profile.avatar_url, { method: 'HEAD' })
      .then(response => {
        console.log("Avatar URL status:", response.status);
        if (!response.ok) {
          console.error("Avatar URL returned non-OK status:", response.status);
          setAvatarLoadError(true);
        }
      })
      .catch(error => {
        console.error("Avatar URL error:", error);
        setAvatarLoadError(true);
      });
  }
}, [profile]);

  // Debug profile data
useEffect(() => {
  console.log("Profile data:", profile);
  if (profile?.avatar_url) {
    console.log("Avatar URL:", profile.avatar_url);
    // Test if the URL is accessible
    fetch(profile.avatar_url, { method: 'HEAD' })
      .then(response => console.log("Avatar URL status:", response.status))
      .catch(error => console.error("Avatar URL error:", error));
  }
}, [profile]);

  return (
    <div className="flex flex-col h-full bg-background p-2">
      <div className="mx-auto w-full">
        <h2 className="text-xl font-semibold mb-8 text-foreground">Profile Settings</h2>

        <div className="space-y-8">
          {/* Profile Section */}
          <section>
            <div className="flex flex-row items-center gap-6 w-full">
<div className="flex-shrink-0 relative">
  <div 
    className="bg-zinc-300 dark:bg-zinc-800 rounded-full w-[200px] h-[200px] flex items-center justify-center overflow-hidden cursor-pointer"
    onClick={triggerFileInput}
  >
    {profile?.avatar_url ? (
      <React.Fragment>
        <img 
          src={profile.avatar_url}
          alt={profile?.name || "Profile"}
          className="w-full h-full object-cover"
          onError={() => {
            console.error("Failed to load avatar image:", profile.avatar_url);
            // We'll handle the fallback in the component state
            setAvatarLoadError(true);
          }}
          style={{ display: avatarLoadError ? 'none' : 'block' }}
        />
        {avatarLoadError && (
          <div className="w-full h-full flex items-center justify-center">
            <Avvvatars 
              value={profile?.name || user?.email || "User"} 
              style="shape" 
              size={200} 
            />
          </div>
        )}
      </React.Fragment>
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <Avvvatars 
          value={profile?.name || user?.email || "User"} 
          style="shape" 
          size={200} 
        />
      </div>
    )}
    
    {/* Upload overlay */}
    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
      <Camera className="w-10 h-10 text-white" />
    </div>
    
    {/* Loading overlay */}
    {isUploadingAvatar && (
      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    )}
  </div>
  <input 
    type="file" 
    ref={fileInputRef}
    className="hidden" 
    accept="image/*" 
    onChange={handleAvatarChange}
  />
  <span className="text-muted-foreground text-xs text-center block mt-1">Profile Picture</span>
  {avatarError && (
    <span className="text-red-500 text-xs text-center block">{avatarError}</span>
  )}
</div>

              {/* Email and Name Container */}
              <div className="flex-1 space-y-3">
                {/* Email Section */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-[10px] p-2 w-full">
                  <span className="text-muted-foreground text-sm">{profile?.email || user?.email || "No email available"}</span>
                  <div className="flex items-center gap-1 text-primary ml-auto">
                    <span className="text-sm">Connected</span>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Name Input Section */}
                <div className="w-full">
                  <div className="mb-1">
                    <span className="text-foreground text-sm font-medium">Display Name</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-800 rounded-[10px] p-2 flex-grow text-foreground"
                    />
                    <button 
                      className="bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 
                        text-foreground px-4 py-2 rounded-[10px] transition-colors duration-200 ease-in-out
                        disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      onClick={handleSaveName}
                      disabled={isSavingName || displayName === profile?.name}
                    >
                      {isSavingName ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                  {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                </div>
              </div>
            </div>
            <div className="mt-4 border-b border-zinc-300 dark:border-zinc-800" />
          </section>

          <div className="mt-4">
            <div className="py-4 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-foreground text-sm">Select Theme</span>
                <span className="text-muted-foreground text-sm">Select your preferred theme</span>
              </div>
              
              <Select
                value={theme}
                onValueChange={(value) => handleThemeChange(value as 'dark' | 'light' | 'system')}
              >
                <SelectTrigger className="w-[140px] bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-800 text-foreground">
                  <SelectValue placeholder="System" />
                </SelectTrigger>
                <SelectContent className='cursor-pointer bg-zinc-200 dark:bg-zinc-800'>
                  <SelectItem className='cursor-pointer bg-zinc-200 dark:bg-zinc-800' value="dark">Dark</SelectItem>
                  <SelectItem className='cursor-pointer bg-zinc-200 dark:bg-zinc-800' value="light">Light</SelectItem>
                  <SelectItem className='cursor-pointer bg-zinc-200 dark:bg-zinc-800' value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Settings Section */}
          <section className="space-y-8">
            {/* Parental Controls */}
            <div className="space-y-4">
              <Collapsible
                open={isParentalOpen}
                onOpenChange={setIsParentalOpen}
                className="w-full"
              >
                <div className="border-b pb-3 border-zinc-200 dark:border-zinc-800">
                  <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer">
                    <div className="flex flex-col text-left">
                      <h3 className="text-lg font-medium text-foreground">Parental Controls</h3>
                      <span className="text-sm text-muted-foreground">Enable content filtering</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={parentalEnabled} 
                        onCheckedChange={setParentalEnabled}
                      />
                      {isParentalOpen ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent>
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mt-3 space-y-4">
                    {/* NSFW Protection Switch */}
                    <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-700">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">NSFW Protection</span>
                        <span className="text-xs text-muted-foreground">Block explicit sexual content</span>
                      </div>
                      <Switch 
                        checked={nsfwEnabled} 
                        onCheckedChange={setNsfwEnabled}
                        disabled={!parentalEnabled}
                      />
                    </div>
                    
                    {/* Profanity Protection Switch */}
                    <div className="flex items-center justify-between py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Profanity Protection</span>
                        <span className="text-xs text-muted-foreground">Filter offensive language</span>
                      </div>
                      <Switch 
                        checked={profanityEnabled} 
                        onCheckedChange={setProfanityEnabled} 
                        disabled={!parentalEnabled}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="flex flex-row gap-3 justify-center items-center">
              {/* UPDATED: Change Password Dialog with full functionality */}
              <Dialog 
                open={isPasswordDialogOpen} 
                onOpenChange={(open) => {
                  setIsPasswordDialogOpen(open);
                  if (!open) {
                    resetPasswordDialog();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button 
                    variant={'default'}
                    className="flex items-center w-full justify-center gap-2 px-4 rounded-[10px]">
                    <Key className="w-4 h-4" />
                    <span>Change Password</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Enter your current password and new password below. Your new password must be at least 6 characters long.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="old-password" className="text-right">
                        Current
                      </Label>
                      <Input
                        id="old-password"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-password" className="text-right">
                        New
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="confirm-password" className="text-right">
                        Confirm
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="col-span-3"
                        placeholder="Confirm new password"
                      />
                    </div>
                    {passwordError && (
                      <p className="text-red-500 text-sm col-span-4">{passwordError}</p>
                    )}
                    {passwordChangeSuccess && (
                      <p className="text-green-500 text-sm col-span-4">Password changed successfully!</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline"
                      onClick={() => setIsPasswordDialogOpen(false)}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handlePasswordChange} 
                      disabled={
                        isChangingPassword || 
                        !oldPassword || 
                        !newPassword || 
                        !confirmPassword || 
                        newPassword !== confirmPassword
                      }
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Changing...
                        </>
                      ) : (
                        'Change Password'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

<Button 
  variant={'default'}
  className="flex items-center w-full justify-center gap-2 px-4 rounded-[10px]"
  onClick={handleSignOut}
>                    
  <LogOut className="w-4 h-4" />
  <span>Logout</span>
</Button>


              {/* Delete Account Button */}
              <Button 
                variant={'destructive'}
                className="flex items-center w-full justify-center gap-2 px-4 rounded-[10px]"
                onClick={handleDeleteAccount}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;