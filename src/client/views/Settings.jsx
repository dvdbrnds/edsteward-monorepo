import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useTheme } from '../context/ThemeContext';

const SettingsContainer = styled.div`
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
`;

const SettingsCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-bottom: 24px;
`;

const SettingsTitle = styled.h2`
  font-size: 20px;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text};
`;

const SettingsSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  margin-bottom: 12px;
  color: ${props => props.theme.colors.text};
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const OptionLabel = styled.div`
  display: flex;
  flex-direction: column;
`;

const OptionTitle = styled.span`
  font-weight: 500;
  margin-bottom: 4px;
`;

const OptionDescription = styled.span`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 52px;
  height: 26px;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
  
  &:checked + span {
    background-color: ${props => props.theme.colors.primary};
  }
  
  &:checked + span:before {
    transform: translateX(26px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${props => props.theme.colors.secondary};
  transition: .4s;
  border-radius: 34px;
  
  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
`;

const Button = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
  }
`;

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    notifications: true,
    cacheResults: true,
    autoValidate: false,
    developerMode: false
  });
  
  const handleToggle = (setting) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };
  
  const saveSettings = () => {
    // In a real app, this would save to API/localStorage
    toast.success('Settings saved successfully');
  };
  
  return (
    <SettingsContainer>
      <SettingsTitle>Settings</SettingsTitle>
      
      <SettingsCard>
        <SettingsSection>
          <SectionTitle>Appearance</SectionTitle>
          <OptionRow>
            <OptionLabel>
              <OptionTitle>Dark Mode</OptionTitle>
              <OptionDescription>Toggle between light and dark theme</OptionDescription>
            </OptionLabel>
            <Toggle>
              <ToggleInput 
                type="checkbox" 
                checked={isDarkMode}
                onChange={toggleTheme}
              />
              <ToggleSlider />
            </Toggle>
          </OptionRow>
        </SettingsSection>
        
        <SettingsSection>
          <SectionTitle>Validation Options</SectionTitle>
          <OptionRow>
            <OptionLabel>
              <OptionTitle>Cache Validation Results</OptionTitle>
              <OptionDescription>Store validation results in cache for faster responses</OptionDescription>
            </OptionLabel>
            <Toggle>
              <ToggleInput 
                type="checkbox" 
                checked={settings.cacheResults}
                onChange={() => handleToggle('cacheResults')}
              />
              <ToggleSlider />
            </Toggle>
          </OptionRow>
          <OptionRow>
            <OptionLabel>
              <OptionTitle>Auto-Validate on Load</OptionTitle>
              <OptionDescription>Automatically validate documents when loaded</OptionDescription>
            </OptionLabel>
            <Toggle>
              <ToggleInput 
                type="checkbox" 
                checked={settings.autoValidate}
                onChange={() => handleToggle('autoValidate')}
              />
              <ToggleSlider />
            </Toggle>
          </OptionRow>
        </SettingsSection>
        
        <SettingsSection>
          <SectionTitle>Notifications</SectionTitle>
          <OptionRow>
            <OptionLabel>
              <OptionTitle>Enable Notifications</OptionTitle>
              <OptionDescription>Show notifications for validation events</OptionDescription>
            </OptionLabel>
            <Toggle>
              <ToggleInput 
                type="checkbox" 
                checked={settings.notifications}
                onChange={() => handleToggle('notifications')}
              />
              <ToggleSlider />
            </Toggle>
          </OptionRow>
        </SettingsSection>
        
        <SettingsSection>
          <SectionTitle>Developer Options</SectionTitle>
          <OptionRow>
            <OptionLabel>
              <OptionTitle>Developer Mode</OptionTitle>
              <OptionDescription>Enable additional debugging features</OptionDescription>
            </OptionLabel>
            <Toggle>
              <ToggleInput 
                type="checkbox" 
                checked={settings.developerMode}
                onChange={() => handleToggle('developerMode')}
              />
              <ToggleSlider />
            </Toggle>
          </OptionRow>
        </SettingsSection>
        
        <Button onClick={saveSettings}>Save Settings</Button>
      </SettingsCard>
    </SettingsContainer>
  );
};

export default Settings; 