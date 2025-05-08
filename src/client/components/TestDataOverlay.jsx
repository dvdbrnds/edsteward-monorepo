import React from 'react';
import styled from 'styled-components';

const OverlayContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
  opacity: 0.7;
`;

const TestText = styled.div`
  color: #ff0000;
  font-size: 5rem;
  font-weight: 900;
  transform: rotate(-30deg);
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.7);
  letter-spacing: 0.1em;
  font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  -webkit-text-stroke: 2px #ff0000;
  text-transform: uppercase;
`;

const TestDataOverlay = () => {
  return (
    <OverlayContainer>
      <TestText>TEST</TestText>
    </OverlayContainer>
  );
};

export default TestDataOverlay; 