'use client';

import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin: 24px 0;
`;

const Title = styled.h2`
  margin-bottom: 16px;
`;

const ColorSection = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid ${props => props.theme.colors.divider};
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
`;

const ColorCard = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.small};
`;

const ColorSwatch = styled.div`
  height: 80px;
  background-color: ${props => props.color};
`;

const ColorInfo = styled.div`
  padding: 12px;
  background-color: ${props => props.theme.colors.paper};
`;

const ColorName = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
`;

const ColorValue = styled.div`
  font-family: ${props => props.theme.fonts.monospace};
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const Description = styled.p`
  margin: 8px 0 24px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.5;
`;

const ColorGuide = () => {
  return (
    <Container>
      <Title>MCP Engine Color System</Title>
      <Description>
        This guide displays the official color palette used throughout the MCP Engine interface. 
        All colors are designed to meet WCAG 2.1 AA accessibility standards.
      </Description>

      <ColorSection>
        <SectionTitle>Primary Colors</SectionTitle>
        <ColorGrid>
          <ColorCard>
            <ColorSwatch color="var(--primary, #1976D2)" />
            <ColorInfo>
              <ColorName>Primary</ColorName>
              <ColorValue>#1976D2</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--primary-light, #42A5F5)" />
            <ColorInfo>
              <ColorName>Primary Light</ColorName>
              <ColorValue>#42A5F5</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--primary-dark, #0D47A1)" />
            <ColorInfo>
              <ColorName>Primary Dark</ColorName>
              <ColorValue>#0D47A1</ColorValue>
            </ColorInfo>
          </ColorCard>
        </ColorGrid>
      </ColorSection>

      <ColorSection>
        <SectionTitle>Secondary Colors</SectionTitle>
        <ColorGrid>
          <ColorCard>
            <ColorSwatch color="var(--secondary, #C2185B)" />
            <ColorInfo>
              <ColorName>Secondary</ColorName>
              <ColorValue>#C2185B</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--secondary-light, #F06292)" />
            <ColorInfo>
              <ColorName>Secondary Light</ColorName>
              <ColorValue>#F06292</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--secondary-dark, #880E4F)" />
            <ColorInfo>
              <ColorName>Secondary Dark</ColorName>
              <ColorValue>#880E4F</ColorValue>
            </ColorInfo>
          </ColorCard>
        </ColorGrid>
      </ColorSection>

      <ColorSection>
        <SectionTitle>Feedback Colors</SectionTitle>
        <ColorGrid>
          <ColorCard>
            <ColorSwatch color="var(--success, #2E7D32)" />
            <ColorInfo>
              <ColorName>Success</ColorName>
              <ColorValue>#2E7D32</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--error, #D32F2F)" />
            <ColorInfo>
              <ColorName>Error</ColorName>
              <ColorValue>#D32F2F</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--warning, #F57C00)" />
            <ColorInfo>
              <ColorName>Warning</ColorName>
              <ColorValue>#F57C00</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--info, #0277BD)" />
            <ColorInfo>
              <ColorName>Info</ColorName>
              <ColorValue>#0277BD</ColorValue>
            </ColorInfo>
          </ColorCard>
        </ColorGrid>
      </ColorSection>

      <ColorSection>
        <SectionTitle>Text Colors</SectionTitle>
        <ColorGrid>
          <ColorCard>
            <ColorSwatch color="var(--text, #212121)" />
            <ColorInfo>
              <ColorName>Text</ColorName>
              <ColorValue>#212121</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--text-secondary, #616161)" />
            <ColorInfo>
              <ColorName>Text Secondary</ColorName>
              <ColorValue>#616161</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--text-disabled, #9E9E9E)" />
            <ColorInfo>
              <ColorName>Text Disabled</ColorName>
              <ColorValue>#9E9E9E</ColorValue>
            </ColorInfo>
          </ColorCard>
        </ColorGrid>
      </ColorSection>

      <ColorSection>
        <SectionTitle>Background Colors</SectionTitle>
        <ColorGrid>
          <ColorCard>
            <ColorSwatch color="var(--background, #F5F5F5)" />
            <ColorInfo>
              <ColorName>Background</ColorName>
              <ColorValue>#F5F5F5</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--paper, #FFFFFF)" />
            <ColorInfo>
              <ColorName>Paper</ColorName>
              <ColorValue>#FFFFFF</ColorValue>
            </ColorInfo>
          </ColorCard>
          <ColorCard>
            <ColorSwatch color="var(--divider, #E0E0E0)" />
            <ColorInfo>
              <ColorName>Divider</ColorName>
              <ColorValue>#E0E0E0</ColorValue>
            </ColorInfo>
          </ColorCard>
        </ColorGrid>
      </ColorSection>
    </Container>
  );
};

export default ColorGuide; 