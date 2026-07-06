import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import Profile from './profile';
import Data from './data';
import { Binary, Browser, FlyingSaucer, HardDrives, LegoSmiley, Palette, ArrowLeft, FlagBanner, PianoKeys } from '@phosphor-icons/react';
import PermissionsManager from '../components/parts/Permissions/PermissionsManager';
import KeyboardShortcuts from './KeyboardShortcuts';

interface TabContent {
  id: number;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

interface SettingsProps {
  initialTabId?: number;
}

const Settings: React.FC<SettingsProps> = ({ initialTabId = 0 }) => {
  const [activeTab, setActiveTab] = useState(initialTabId);
  const [indicatorStyle, setIndicatorStyle] = useState({
    width: 0,
    transform: 'translateX(0px)',
  });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Update activeTab when initialTabId changes
  useEffect(() => {
    setActiveTab(initialTabId);
  }, [initialTabId]);

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        width: activeTabElement.offsetWidth,
        transform: `translateX(${activeTabElement.offsetLeft}px)`,
      });
    }
  }, [activeTab]);

  const tabs: TabContent[] = [
    {
      id: 0,
      title: 'Profile',
      icon: <LegoSmiley className="size-4" />,
      component: <Profile />
    },
    {
      id: 1,
      title: 'Data',
      icon: <HardDrives className="size-4" />,
      component: <Data />
    },
    {
      id: 2,
      title: 'Permissions',
      icon: <FlagBanner className="size-4" />,
      component: <PermissionsManager />
    },
    {
      id: 3,
      title: 'Keyboard Shortcuts',
      icon: <PianoKeys className="size-4" />,
      component: <KeyboardShortcuts />
    },
  ];

  return (
    <div className="flex flex-col bg-background w-full h-[500px]">
      {/* Horizontal Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700/50">
        <div className="relative flex items-center px-2">
          {/* Smooth sliding indicator - Bottom */}
          <div
            className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-transform duration-300 ease-out"
            style={indicatorStyle}
          />

          <div className="flex gap-1.5 py-2">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={el => tabRefs.current[tab.id] = el}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative flex items-center gap-2 px-4 py-2.5 rounded-md
                  text-sm transition-colors duration-200 ease-in-out
                  ${
                    activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }
                `}
              >
                <span className={`transition-colors duration-200 ${activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  {tab.icon}
                </span>
                <span className="truncate">{tab.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative sidebar-scrollbar">
        <div className="absolute h-full w-full sidebar-scrollbar inset-0 overflow-y-auto overflow-x-hidden">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                absolute inset-0 p-6 overflow-y-auto transition-all duration-200 ease-out 
                ${
                  activeTab === tab.id
                    ? 'translate-y-0 opacity-100 z-10 visible'
                    : 'translate-y-4 opacity-0 -z-10 invisible'
                }
              `}
            >
              {tab.component}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;