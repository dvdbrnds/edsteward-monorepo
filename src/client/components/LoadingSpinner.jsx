/**
 * Loading Spinner Component - Phase 3
 * Modern loading indicator with various sizes and styles
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';

// Spinner animation
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Pulse animation for fallback
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const SpinnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.space[4]};
  
  ${props => props.fullScreen && `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 9999;
  `}
  
  ${props => props.overlay && `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.9);
    z-index: 10;
  `}
`;

const Spinner = styled.div`
  border: 2px solid ${props => props.theme.colors.divider};
  border-top: 2px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  
  ${props => {
    switch (props.size) {
      case 'small':
        return `width: 16px; height: 16px;`;
      case 'medium':
        return `width: 24px; height: 24px;`;
      case 'large':
        return `width: 40px; height: 40px;`;
      default:
        return `width: 24px; height: 24px;`;
    }
  }}
`;

const LoadingText = styled.p`
  margin-top: ${props => props.theme.space[2]};
  color: ${props => props.theme.colors.textSecondary};
  font-size: ${props => props.theme.fontSizes[1]}px;
  text-align: center;
`;

const DotsContainer = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.primary};
  animation: ${pulse} 1.4s ease-in-out infinite both;
  animation-delay: ${props => props.delay}s;
`;

const SkeletonPulse = styled.div`
  background: linear-gradient(
    90deg,
    ${props => props.theme.colors.divider} 25%,
    ${props => props.theme.colors.neutralLight} 50%,
    ${props => props.theme.colors.divider} 75%
  );
  background-size: 200% 100%;
  animation: ${keyframes`
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  `} 2s ease-in-out infinite;
  border-radius: ${props => props.theme.radii[1]}px;
  
  ${props => props.variant === 'text' && `
    height: 16px;
    margin-bottom: 8px;
  `}
  
  ${props => props.variant === 'card' && `
    height: 120px;
    margin-bottom: 16px;
  `}
  
  ${props => props.variant === 'avatar' && `
    width: 40px;
    height: 40px;
    border-radius: 50%;
  `}
`;

// Inline spinner for buttons
const InlineSpinner = styled(Spinner)`
  display: inline-block;
  margin-right: ${props => props.theme.space[1]};
  vertical-align: middle;
`;

// Loading Spinner Component
const LoadingSpinner = ({ 
  size = 'medium', 
  text, 
  variant = 'spinner',
  fullScreen = false,
  overlay = false,
  className,
  ...props 
}) => {
  if (variant === 'dots') {
    return (
      <SpinnerContainer fullScreen={fullScreen} overlay={overlay} className={className} {...props}>
        <DotsContainer>
          <Dot delay={0} />
          <Dot delay={0.2} />
          <Dot delay={0.4} />
        </DotsContainer>
        {text && <LoadingText>{text}</LoadingText>}
      </SpinnerContainer>
    );
  }

  if (variant === 'skeleton') {
    return (
      <SkeletonPulse variant="card" className={className} {...props} />
    );
  }

  return (
    <SpinnerContainer fullScreen={fullScreen} overlay={overlay} className={className} {...props}>
      <Spinner size={size} />
      {text && <LoadingText>{text}</LoadingText>}
    </SpinnerContainer>
  );
};

// Skeleton loading components
export const SkeletonText = ({ lines = 1, className, ...props }) => (
  <div className={className} {...props}>
    {Array.from({ length: lines }, (_, i) => (
      <SkeletonPulse key={i} variant="text" />
    ))}
  </div>
);

export const SkeletonCard = ({ className, ...props }) => (
  <SkeletonPulse variant="card" className={className} {...props} />
);

export const SkeletonAvatar = ({ className, ...props }) => (
  <SkeletonPulse variant="avatar" className={className} {...props} />
);

// Button loading spinner
export const ButtonSpinner = ({ size = 'small' }) => (
  <InlineSpinner size={size} />
);

// Loading overlay component
export const LoadingOverlay = ({ children, loading, text, ...props }) => {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      {loading && (
        <LoadingSpinner 
          overlay 
          text={text} 
          {...props}
        />
      )}
    </div>
  );
};

export default LoadingSpinner; 