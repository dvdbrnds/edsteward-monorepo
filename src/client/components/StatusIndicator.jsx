import React from 'react';
import styled from 'styled-components';

const StatusIndicatorDiv = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.status) {
      case 'running':
      case 'Running':
        return props.theme.colors.success;
      case 'stopped':
      case 'Stopped':
        return props.theme.colors.error;
      case 'error':
        return props.theme.colors.error;
      case 'warning':
        return props.theme.colors.warning;
      case 'success':
        return props.theme.colors.success;
      case 'info':
        return props.theme.colors.info;
      default:
        return props.theme.colors.gray;
    }
  }};
  margin-right: 8px;
  ${props => props.bold ? 'width: 16px; height: 16px;' : ''}
`;

const StatusIndicator = ({ status, bold }) => {
  const lowerStatus = typeof status === 'string' ? status.toLowerCase() : status;
  return <StatusIndicatorDiv status={lowerStatus} bold={bold} />;
};

export default StatusIndicator; 